import {
  Droplets, Sprout, Sun, CloudRain, Cpu, Home, Calendar,
  Settings, Play, SkipForward, WifiOff, Link, Unlink, Shield, Lock,
  Database, Leaf, ChevronRight, X, XCircle, Plus, AlertTriangle,
  CheckCircle, Clock, Thermometer, Wind, BarChart2, LogOut,
  Edit2, Trash2, Power, RefreshCw, MapPin, Activity,
} from 'lucide-react'
import type { LucideProps } from 'lucide-react'

const icons = {
  droplet: Droplets,
  sprout: Sprout,
  sun: Sun,
  cloudRain: CloudRain,
  cpu: Cpu,
  home: Home,
  cal: Calendar,
  settings: Settings,
  play: Play,
  skip: SkipForward,
  wifiOff: WifiOff,
  link: Link,
  unlink: Unlink,
  xCircle: XCircle,
  activity: Activity,
  shield: Shield,
  lock: Lock,
  db: Database,
  leaf: Leaf,
  chevronRight: ChevronRight,
  x: X,
  plus: Plus,
  warn: AlertTriangle,
  check: CheckCircle,
  clock: Clock,
  temp: Thermometer,
  wind: Wind,
  chart: BarChart2,
  logout: LogOut,
  edit: Edit2,
  trash: Trash2,
  power: Power,
  refresh: RefreshCw,
  pin: MapPin,
} as const

export type IconName = keyof typeof icons

type Props = { name: IconName; size?: number } & Omit<LucideProps, 'size'>

export function Icon({ name, size = 16, ...rest }: Props) {
  const Cmp = icons[name]
  return <Cmp size={size} strokeWidth={1.75} {...rest} />
}
