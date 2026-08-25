---
name: go-concurrency
description: Go 并发最佳实践 — goroutine 生命周期管理、channel 模式、context 取消、竞态检测。编写并发代码、排查竞态问题时使用。
---

# Go 并发最佳实践

安全、高效地使用 goroutine 和 channel。

## 核心原则
1. **每个 goroutine 必须有退出路径** — 否则泄漏
2. **用 context 控制生命周期** — `ctx.Done()` 是退出信号
3. **channel 关闭由发送方负责** — 接收方关闭会 panic
4. **优先用 sync.Mutex 保护共享状态** — 比 channel 更直观

## 常用模式

### Worker Pool
```go
func worker(ctx context.Context, jobs <-chan Job, results chan<- Result) {
    for {
        select {
        case <-ctx.Done():
            return
        case job, ok := <-jobs:
            if !ok { return }
            results <- process(job)
        }
    }
}
```

### Fan-out / Fan-in
- Fan-out: 一个 channel 分发给多个 goroutine
- Fan-in: 多个 goroutine 的结果合并到一个 channel

## 竞态检测
```bash
go test -race ./...    # 运行时竞态检测
go vet ./...           # 静态分析
```
