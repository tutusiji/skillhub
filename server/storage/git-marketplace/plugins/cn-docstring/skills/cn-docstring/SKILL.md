---
name: cn-docstring
description: 中文注释生成器 — 为函数、类、模块自动生成规范的中文文档注释。支持 Python、JavaScript/TypeScript、Go、Java 等多语言。写完代码后补充注释时使用。
---

# 中文注释生成器

分析函数签名和实现逻辑，自动生成规范的中文文档注释。

## 各语言注释格式

### Python (docstring)

```python
def calculate_discount(price: float, level: str) -> float:
    """计算会员折扣价格

    根据会员等级计算最终折扣价格，支持银卡、金卡、钻石三个等级。

    Args:
        price: 原始价格，单位元
        level: 会员等级，可选值: silver/gold/diamond

    Returns:
        折扣后的价格，保留两位小数

    Raises:
        ValueError: 当 level 不是有效等级时抛出

    Example:
        >>> calculate_discount(100, 'gold')
        80.0
    """
```

### JavaScript / TypeScript (JSDoc)

```javascript
/**
 * 计算会员折扣价格
 *
 * 根据会员等级计算最终折扣价格，支持银卡、金卡、钻石三个等级。
 *
 * @param {number} price - 原始价格，单位元
 * @param {'silver' | 'gold' | 'diamond'} level - 会员等级
 * @returns {number} 折扣后的价格，保留两位小数
 * @throws {Error} 当 level 不是有效等级时抛出
 * @example
 * calculateDiscount(100, 'gold') // 80.0
 */
function calculateDiscount(price, level) { ... }
```

### Go (doc comment)

```go
// CalculateDiscount 计算会员折扣价格
//
// 根据会员等级计算最终折扣价格，支持银卡、金卡、钻石三个等级。
// price 为原始价格（单位: 元），level 为会员等级 (silver/gold/diamond)。
// 返回折扣后的价格，保留两位小数。
// 当 level 无效时返回 error。
func CalculateDiscount(price float64, level string) (float64, error) { ... }
```

### Java (Javadoc)

```java
/**
 * 计算会员折扣价格
 *
 * <p>根据会员等级计算最终折扣价格，支持银卡、金卡、钻石三个等级。
 *
 * @param price 原始价格，单位元
 * @param level 会员等级，可选值: silver/gold/diamond
 * @return 折扣后的价格，保留两位小数
 * @throws IllegalArgumentException 当 level 不是有效等级时抛出
 */
public BigDecimal calculateDiscount(BigDecimal price, String level) { ... }
```

## 注释原则

1. **描述意图，不复述代码** — 写"为什么"和"做什么"，不写"怎么做"
2. **参数说明具体** — 不写"价格参数"，写"原始价格，单位元"
3. **标注异常条件** — 什么输入会抛异常
4. **给真实示例** — 用实际输入输出，不用占位符
5. **复杂逻辑加行内注释** — 算法关键步骤用 `//` 说明原因

## 不需要注释的情况

- getter/setter 等不言自明的函数
- 简单的 CRUD 包装
- 测试函数（函数名已说明意图）

## 工作流程

1. 读取目标函数/类的源码
2. 分析参数、返回值、异常、业务逻辑
3. 根据语言选择对应注释格式
4. 生成中文注释并插入源码
5. 保留原有有价值的注释，只补充缺失部分
