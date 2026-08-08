import type { Rol, AreaPermiso } from '@/lib/types/models'

export type Action = 'ver' | 'crear' | 'editar' | 'aprobar' | 'archivar'

/**
 * Calcula permisos efectivos combinando múltiples roles
 * Los permisos se unen con lógica OR: si algún rol permite, el usuario puede
 */
export function getEffectivePermissions(roles: Rol[]): Record<string, AreaPermiso> {
  const merged: Record<string, AreaPermiso> = {}

  if (!roles || roles.length === 0) {
    return merged
  }

  roles.forEach(role => {
    if (!role.areas_permitidas) return

    Object.entries(role.areas_permitidas).forEach(([area, permisos]) => {
      if (!merged[area]) {
        merged[area] = { ver: false }
      }

      // Unir permisos: si algún rol permite, el usuario puede
      merged[area].ver = merged[area].ver || permisos.ver || false
      merged[area].crear = merged[area].crear || permisos.crear || false
      merged[area].editar = merged[area].editar || permisos.editar || false
      merged[area].aprobar = merged[area].aprobar || permisos.aprobar || false
      merged[area].ambito = permisos.ambito || merged[area].ambito
    })
  })

  return merged
}

/**
 * Valida si un usuario (mediante sus roles) puede realizar una acción en un área
 */
export function canUserAccess(roles: Rol[], area: string, action: Action): boolean {
  // Si no hay roles, no puede acceder
  if (!roles || roles.length === 0) {
    return false
  }

  // Verificar si alguno de los roles tiene permiso
  return roles.some(role => {
    const areaPermisos = role.areas_permitidas?.[area]
    if (!areaPermisos) return false

    // Acciones válidas
    if (action === 'ver') {
      return areaPermisos.ver === true
    }

    return (areaPermisos as any)[action] === true
  })
}

/**
 * Obtiene las áreas que un usuario puede ver
 */
export function getAccessibleAreas(roles: Rol[]): string[] {
  const areas = new Set<string>()

  roles.forEach(role => {
    if (role.areas_permitidas) {
      Object.entries(role.areas_permitidas).forEach(([area, permisos]) => {
        if (permisos.ver) {
          areas.add(area)
        }
      })
    }
  })

  return Array.from(areas)
}

/**
 * Obtiene los permisos de un usuario en un área específica
 */
export function getAreaPermissions(roles: Rol[], area: string): AreaPermiso | null {
  for (const role of roles) {
    const permisos = role.areas_permitidas?.[area]
    if (permisos?.ver) {
      return permisos
    }
  }
  return null
}

/**
 * Valida si un usuario es administrador del sistema
 */
export function isSystemAdmin(roles: Rol[]): boolean {
  return roles.some(role => role.nombre === 'Administrador del sistema')
}
