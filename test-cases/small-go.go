// 小型 Go 测试用例：HTTP 请求处理器

package handlers

import (
	"encoding/json"
	"net/http"
	"strings"
	"time"
)

type Product struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Price       float64   `json:"price"`
	Stock       int       `json:"stock"`
	Category    string    `json:"category"`
	CreatedAt   time.Time `json:"created_at"`
}

type CreateProductRequest struct {
	Name     string  `json:"name"`
	Price    float64 `json:"price"`
	Stock    int     `json:"stock"`
	Category string  `json:"category"`
}

type ErrorResponse struct {
	Error   string `json:"error"`
	Code    int    `json:"code"`
}

func HandleCreateProduct(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		respondWithError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req CreateProductRequest
	decoder := json.NewDecoder(r.Body)
	if err := decoder.Decode(&req); err != nil {
		respondWithError(w, "Invalid JSON format", http.StatusBadRequest)
		return
	}

	if strings.TrimSpace(req.Name) == "" {
		respondWithError(w, "Product name is required", http.StatusBadRequest)
		return
	}

	if req.Price <= 0 {
		respondWithError(w, "Price must be greater than 0", http.StatusBadRequest)
		return
	}

	if req.Stock < 0 {
		respondWithError(w, "Stock cannot be negative", http.StatusBadRequest)
		return
	}

	if strings.TrimSpace(req.Category) == "" {
		respondWithError(w, "Category is required", http.StatusBadRequest)
		return
	}

	product := Product{
		ID:        generateID(),
		Name:      strings.TrimSpace(req.Name),
		Price:     req.Price,
		Stock:     req.Stock,
		Category:  strings.TrimSpace(req.Category),
		CreatedAt: time.Now(),
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(product)
}

func respondWithError(w http.ResponseWriter, message string, code int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(ErrorResponse{
		Error: message,
		Code:  code,
	})
}

func generateID() string {
	return "prod_" + time.Now().Format("20060102150405")
}
