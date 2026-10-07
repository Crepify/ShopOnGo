import { Radio } from 'lucide-react'
export function EmptyState({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) { return <div className="empty-state"><div className="empty-icon"><Radio size={20} /></div><h3>{title}</h3><p>{description}</p>{action}</div> }
