/**
 * Извлечение суммы в копейках из различных форматов API МойСклад.
 * API может возвращать: число, объект { value }, объект с meta (ссылка), массив prices.
 * value — в копейках (0.01 RUB) для рублёвой валюты.
 * Если число дробное (100.50) — трактуем как рубли, умножаем на 100.
 */
export function extractKopecks(val: unknown): number {
  if (val == null) return 0
  if (typeof val === 'number' && !Number.isNaN(val)) {
    // Дробное число — скорее рубли; целое > 10 — скорее копейки
    if (Number.isInteger(val)) return Math.round(val)
    return Math.round(val * 100)
  }
  if (typeof val === 'object') {
    const o = val as Record<string, unknown>
    // Прямые поля
    const direct = o.value ?? o.sum ?? o.price
    if (typeof direct === 'number') return Math.round(direct)
    // Массив prices (тип цены)
    if (Array.isArray(o.prices) && o.prices[0] && typeof o.prices[0] === 'object') {
      const p = o.prices[0] as Record<string, unknown>
      const pv = p.value ?? p.sum ?? p.price
      if (typeof pv === 'number') return Math.round(pv)
    }
    // Рекурсивный поиск value в объекте (для вложенных структур)
    const found = findNumericValue(o)
    if (found !== null) return Math.round(found)
  }
  return 0
}

function findNumericValue(obj: Record<string, unknown>): number | null {
  const priceKeys = ['value', 'sum', 'price']
  for (const k of priceKeys) {
    const v = obj[k]
    if (typeof v === 'number' && !Number.isNaN(v)) return v
  }
  // Рекурсия только в объекты, похожие на цену (имеют value/currency/meta)
  for (const v of Object.values(obj)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const o = v as Record<string, unknown>
      if ('value' in o || 'currency' in o || ('meta' in o && 'value' in o)) {
        const nested = findNumericValue(o)
        if (nested !== null) return nested
      }
    }
  }
  return null
}

/**
 * Извлечение цены и суммы из позиции заказа МойСклад.
 * Пробует row.price, row.salePrice, row.assortment.salePrices, row.assortment.product.salePrices.
 */
export function extractPositionPriceAndSum(row: Record<string, unknown>): {
  priceKopecks: number
  sumKopecks: number
} {
  let priceKopecks = extractKopecks(row.price) || extractKopecks((row as any).salePrice)
  let sumKopecks = extractKopecks(row.sum) || extractKopecks((row as any).totalSum)

  // Fallback: цена из номенклатуры (assortment.salePrices или product.salePrices)
  if (priceKopecks === 0) {
    const assortment = row.assortment as Record<string, unknown> | undefined
    if (assortment) {
      const prices = (assortment.salePrices as Array<{ value?: number }>) ?? (assortment.prices as Array<{ value?: number }>)
      if (Array.isArray(prices) && prices[0]) {
        priceKopecks = extractKopecks(prices[0])
      }
      if (priceKopecks === 0) {
        const product = assortment.product as Record<string, unknown> | undefined
        if (product) {
          const prodPrices = (product.salePrices as Array<{ value?: number }>) ?? (product.prices as Array<{ value?: number }>)
          if (Array.isArray(prodPrices) && prodPrices[0]) {
            priceKopecks = extractKopecks(prodPrices[0])
          }
        }
      }
    }
  }

  if (sumKopecks === 0 && priceKopecks > 0) {
    const quantity = typeof row.quantity === 'number' ? row.quantity : Number(row.quantity || 0)
    if (quantity > 0) sumKopecks = Math.round(priceKopecks * quantity)
  }

  return { priceKopecks, sumKopecks }
}
