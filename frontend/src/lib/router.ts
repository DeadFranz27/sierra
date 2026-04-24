export type Route =
  | { page: 'dashboard' }
  | { page: 'zones' }
  | { page: 'zone'; id: string }
  | { page: 'schedule' }
  | { page: 'profiles' }
  | { page: 'device' }

export function parsePath(path: string): Route {
  const parts = path.replace(/^\//, '').split('/')
  switch (parts[0]) {
    case '':
    case 'dashboard': return { page: 'dashboard' }
    case 'zones':
      if (parts[1]) return { page: 'zone', id: parts[1] }
      return { page: 'zones' }
    case 'schedule':  return { page: 'schedule' }
    case 'profiles':  return { page: 'profiles' }
    case 'device':    return { page: 'device' }
    default:          return { page: 'dashboard' }
  }
}

export function routeToPath(route: Route): string {
  switch (route.page) {
    case 'dashboard': return '/dashboard'
    case 'zones':     return '/zones'
    case 'zone':      return `/zones/${route.id}`
    case 'schedule':  return '/schedule'
    case 'profiles':  return '/profiles'
    case 'device':    return '/device'
  }
}

export function navigate(route: Route) {
  window.history.pushState({}, '', routeToPath(route))
  window.dispatchEvent(new PopStateEvent('popstate'))
}
