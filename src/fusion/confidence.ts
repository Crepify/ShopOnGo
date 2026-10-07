export const CONFIRMATION_THRESHOLD = 0.78
export const HUMAN_REVIEW_THRESHOLD = 0.62
export function confidenceBand(value: number) { return value >= CONFIRMATION_THRESHOLD ? 'CONFIRMABLE' : value >= HUMAN_REVIEW_THRESHOLD ? 'PROVISIONAL' : 'UNCERTAIN' }
