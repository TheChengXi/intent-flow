// @intent: 用例接口，定义用例的统一执行方法

export interface IUseCase<TInput, TOutput> {
  /**
   * 执行用例
   * @param input 输入参数
   * @returns 输出结果
   */
  execute(input: TInput): Promise<TOutput>;
}
