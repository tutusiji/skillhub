---
name: go-testing
description: Go 测试最佳实践 — table-driven 测试、mock、基准测试、覆盖率分析。编写 Go 测试代码时使用，确保测试规范且覆盖全面。
---

# Go 测试最佳实践

编写符合社区标准的 Go 测试代码。

## 测试结构

### Table-Driven 测试（推荐）
```go
func TestFoo(t *testing.T) {
    tests := []struct {
        name     string
        input    string
        expected int
    }{
        {"空字符串", "", 0},
        {"正常输入", "abc", 3},
        {"边界值", "a", 1},
    }
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            got := Foo(tt.input)
            if got != tt.expected {
                t.Errorf("Foo(%q) = %d, want %d", tt.input, got, tt.expected)
            }
        })
    }
}
```

## 测试规范
- 测试文件命名: `xxx_test.go`，与被测文件同目录
- 函数命名: `Test<函数名>`、`Benchmark<函数名>`
- 子测试用 `t.Run()`，名称用中文可读
- 错误信息包含输入和期望值
- 避免在测试中使用 `panic`，用 `t.Fatal` 代替

## 覆盖率
- 目标: 核心逻辑 > 80%，工具函数 > 90%
- 运行: `go test -cover -coverprofile=coverage.out`
- 查看: `go tool cover -html=coverage.out`
