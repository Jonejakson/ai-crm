export interface PipelineStage {
  name: string
  color?: string
  probability?: number
}

export function parsePipelineStages(stages: string | null | undefined): PipelineStage[] {
  if (!stages) {
    return []
  }

  try {
    const parsed = JSON.parse(stages)
    if (Array.isArray(parsed)) {
      if (parsed.length === 0) {
        return []
      }

      if (typeof parsed[0] === 'string') {
        return parsed.map((name, index) => ({
          name: String(name),
          probability: Math.min(100, Math.max(0, Math.round(((index + 1) / parsed.length) * 100))),
        }))
      }

      if (typeof parsed[0] === 'object' && parsed[0] !== null) {
        return parsed.map((stage: any, index: number) => ({
          name: stage.name ?? `Этап ${index + 1}`,
          color: stage.color,
          probability:
            typeof stage.probability === 'number'
              ? stage.probability
              : Math.min(100, Math.max(0, Math.round(((index + 1) / parsed.length) * 100))),
        }))
      }
    }
  } catch (error) {
    console.warn('[pipelines][parse] Failed to parse stages JSON', error)
  }

  return []
}

