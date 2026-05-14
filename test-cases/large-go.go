// 大型 Go 测试用例：任务调度系统（约300行）

package scheduler

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"time"
)

// ==================== 类型定义 ====================

type TaskStatus string

const (
	TaskStatusPending   TaskStatus = "PENDING"
	TaskStatusRunning   TaskStatus = "RUNNING"
	TaskStatusCompleted TaskStatus = "COMPLETED"
	TaskStatusFailed    TaskStatus = "FAILED"
	TaskStatusCancelled TaskStatus = "CANCELLED"
	TaskStatusRetrying  TaskStatus = "RETRYING"
)

type TaskPriority int

const (
	PriorityLow    TaskPriority = 1
	PriorityNormal TaskPriority = 5
	PriorityHigh   TaskPriority = 10
	PriorityCritical TaskPriority = 20
)

type Task struct {
	ID          string
	Name        string
	Description string
	Priority    TaskPriority
	Status      TaskStatus
	Handler     TaskHandler
	MaxRetries  int
	RetryCount  int
	Timeout     time.Duration
	CreatedAt   time.Time
	StartedAt   *time.Time
	CompletedAt *time.Time
	Error       error
	Result      interface{}
	Dependencies []string
	Metadata    map[string]interface{}
}

type TaskHandler func(ctx context.Context, task *Task) (interface{}, error)

type TaskResult struct {
	TaskID    string
	Success   bool
	Result    interface{}
	Error     error
	Duration  time.Duration
	Timestamp time.Time
}

type SchedulerConfig struct {
	MaxWorkers      int
	QueueSize       int
	RetryDelay      time.Duration
	DefaultTimeout  time.Duration
	EnableMetrics   bool
}

// ==================== 调度器 ====================

type Scheduler struct {
	config        SchedulerConfig
	tasks         map[string]*Task
	taskQueue     chan *Task
	results       chan *TaskResult
	workers       []*Worker
	mu            sync.RWMutex
	ctx           context.Context
	cancel        context.CancelFunc
	wg            sync.WaitGroup
	isRunning     bool
	metrics       *Metrics
}

type Worker struct {
	id        int
	scheduler *Scheduler
	taskChan  chan *Task
	ctx       context.Context
}

type Metrics struct {
	TotalTasks      int64
	CompletedTasks  int64
	FailedTasks     int64
	CancelledTasks  int64
	AverageDuration time.Duration
	mu              sync.RWMutex
}

// ==================== 错误定义 ====================

var (
	ErrTaskNotFound       = errors.New("task not found")
	ErrTaskAlreadyExists  = errors.New("task already exists")
	ErrSchedulerNotRunning = errors.New("scheduler is not running")
	ErrSchedulerAlreadyRunning = errors.New("scheduler is already running")
	ErrInvalidPriority    = errors.New("invalid task priority")
	ErrDependencyNotMet   = errors.New("task dependencies not met")
	ErrTaskTimeout        = errors.New("task execution timeout")
	ErrMaxRetriesExceeded = errors.New("max retries exceeded")
)

// ==================== 调度器方法 ====================

func NewScheduler(config SchedulerConfig) *Scheduler {
	if config.MaxWorkers <= 0 {
		config.MaxWorkers = 10
	}
	if config.QueueSize <= 0 {
		config.QueueSize = 100
	}
	if config.RetryDelay <= 0 {
		config.RetryDelay = 5 * time.Second
	}
	if config.DefaultTimeout <= 0 {
		config.DefaultTimeout = 30 * time.Second
	}

	ctx, cancel := context.WithCancel(context.Background())

	return &Scheduler{
		config:    config,
		tasks:     make(map[string]*Task),
		taskQueue: make(chan *Task, config.QueueSize),
		results:   make(chan *TaskResult, config.QueueSize),
		workers:   make([]*Worker, 0, config.MaxWorkers),
		ctx:       ctx,
		cancel:    cancel,
		metrics:   &Metrics{},
	}
}

func (s *Scheduler) Start() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.isRunning {
		return ErrSchedulerAlreadyRunning
	}

	for i := 0; i < s.config.MaxWorkers; i++ {
		worker := &Worker{
			id:        i,
			scheduler: s,
			taskChan:  s.taskQueue,
			ctx:       s.ctx,
		}
		s.workers = append(s.workers, worker)
		s.wg.Add(1)
		go worker.start()
	}

	s.wg.Add(1)
	go s.processResults()

	s.isRunning = true
	return nil
}

func (s *Scheduler) Stop() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if !s.isRunning {
		return ErrSchedulerNotRunning
	}

	s.cancel()
	close(s.taskQueue)
	s.wg.Wait()
	close(s.results)

	s.isRunning = false
	return nil
}

func (s *Scheduler) AddTask(task *Task) error {
	if task == nil {
		return errors.New("task cannot be nil")
	}

	if task.ID == "" {
		return errors.New("task ID cannot be empty")
	}

	if task.Handler == nil {
		return errors.New("task handler cannot be nil")
	}

	if task.Priority < PriorityLow || task.Priority > PriorityCritical {
		return ErrInvalidPriority
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	if _, exists := s.tasks[task.ID]; exists {
		return ErrTaskAlreadyExists
	}

	if task.Timeout == 0 {
		task.Timeout = s.config.DefaultTimeout
	}

	if task.MaxRetries == 0 {
		task.MaxRetries = 3
	}

	task.Status = TaskStatusPending
	task.CreatedAt = time.Now()
	task.RetryCount = 0

	if task.Metadata == nil {
		task.Metadata = make(map[string]interface{})
	}

	s.tasks[task.ID] = task

	if s.config.EnableMetrics {
		s.metrics.mu.Lock()
		s.metrics.TotalTasks++
		s.metrics.mu.Unlock()
	}

	return nil
}

func (s *Scheduler) SubmitTask(taskID string) error {
	s.mu.RLock()
	task, exists := s.tasks[taskID]
	s.mu.RUnlock()

	if !exists {
		return ErrTaskNotFound
	}

	if !s.isRunning {
		return ErrSchedulerNotRunning
	}

	if err := s.checkDependencies(task); err != nil {
		return err
	}

	select {
	case s.taskQueue <- task:
		return nil
	case <-s.ctx.Done():
		return ErrSchedulerNotRunning
	default:
		return errors.New("task queue is full")
	}
}

func (s *Scheduler) CancelTask(taskID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	task, exists := s.tasks[taskID]
	if !exists {
		return ErrTaskNotFound
	}

	if task.Status == TaskStatusCompleted || task.Status == TaskStatusFailed {
		return errors.New("cannot cancel completed or failed task")
	}

	task.Status = TaskStatusCancelled
	now := time.Now()
	task.CompletedAt = &now

	if s.config.EnableMetrics {
		s.metrics.mu.Lock()
		s.metrics.CancelledTasks++
		s.metrics.mu.Unlock()
	}

	return nil
}

func (s *Scheduler) GetTask(taskID string) (*Task, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	task, exists := s.tasks[taskID]
	if !exists {
		return nil, ErrTaskNotFound
	}

	return task, nil
}

func (s *Scheduler) GetTasksByStatus(status TaskStatus) []*Task {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var result []*Task
	for _, task := range s.tasks {
		if task.Status == status {
			result = append(result, task)
		}
	}

	return result
}

func (s *Scheduler) GetMetrics() *Metrics {
	if !s.config.EnableMetrics {
		return nil
	}

	s.metrics.mu.RLock()
	defer s.metrics.mu.RUnlock()

	return &Metrics{
		TotalTasks:      s.metrics.TotalTasks,
		CompletedTasks:  s.metrics.CompletedTasks,
		FailedTasks:     s.metrics.FailedTasks,
		CancelledTasks:  s.metrics.CancelledTasks,
		AverageDuration: s.metrics.AverageDuration,
	}
}

func (s *Scheduler) checkDependencies(task *Task) error {
	if len(task.Dependencies) == 0 {
		return nil
	}

	s.mu.RLock()
	defer s.mu.RUnlock()

	for _, depID := range task.Dependencies {
		depTask, exists := s.tasks[depID]
		if !exists {
			return fmt.Errorf("dependency task not found: %s", depID)
		}

		if depTask.Status != TaskStatusCompleted {
			return ErrDependencyNotMet
		}
	}

	return nil
}

func (s *Scheduler) processResults() {
	defer s.wg.Done()

	for result := range s.results {
		s.mu.Lock()
		task, exists := s.tasks[result.TaskID]
		if exists {
			if result.Success {
				task.Status = TaskStatusCompleted
				task.Result = result.Result
			} else {
				if task.RetryCount < task.MaxRetries {
					task.Status = TaskStatusRetrying
					task.RetryCount++
					go s.retryTask(task)
				} else {
					task.Status = TaskStatusFailed
					task.Error = result.Error
				}
			}
			task.CompletedAt = &result.Timestamp
		}
		s.mu.Unlock()

		if s.config.EnableMetrics {
			s.updateMetrics(result)
		}
	}
}

func (s *Scheduler) retryTask(task *Task) {
	time.Sleep(s.config.RetryDelay)

	s.mu.RLock()
	if task.Status == TaskStatusCancelled {
		s.mu.RUnlock()
		return
	}
	s.mu.RUnlock()

	s.SubmitTask(task.ID)
}

func (s *Scheduler) updateMetrics(result *TaskResult) {
	s.metrics.mu.Lock()
	defer s.metrics.mu.Unlock()

	if result.Success {
		s.metrics.CompletedTasks++
	} else {
		s.metrics.FailedTasks++
	}

	totalCompleted := s.metrics.CompletedTasks
	if totalCompleted > 0 {
		currentAvg := s.metrics.AverageDuration
		s.metrics.AverageDuration = (currentAvg*time.Duration(totalCompleted-1) + result.Duration) / time.Duration(totalCompleted)
	}
}

// ==================== Worker 方法 ====================

func (w *Worker) start() {
	defer w.scheduler.wg.Done()

	for {
		select {
		case task, ok := <-w.taskChan:
			if !ok {
				return
			}
			w.executeTask(task)
		case <-w.ctx.Done():
			return
		}
	}
}

func (w *Worker) executeTask(task *Task) {
	startTime := time.Now()

	w.scheduler.mu.Lock()
	task.Status = TaskStatusRunning
	task.StartedAt = &startTime
	w.scheduler.mu.Unlock()

	ctx, cancel := context.WithTimeout(w.ctx, task.Timeout)
	defer cancel()

	resultChan := make(chan *TaskResult, 1)

	go func() {
		result, err := task.Handler(ctx, task)
		resultChan <- &TaskResult{
			TaskID:    task.ID,
			Success:   err == nil,
			Result:    result,
			Error:     err,
			Duration:  time.Since(startTime),
			Timestamp: time.Now(),
		}
	}()

	select {
	case result := <-resultChan:
		w.scheduler.results <- result
	case <-ctx.Done():
		w.scheduler.results <- &TaskResult{
			TaskID:    task.ID,
			Success:   false,
			Error:     ErrTaskTimeout,
			Duration:  time.Since(startTime),
			Timestamp: time.Now(),
		}
	}
}
