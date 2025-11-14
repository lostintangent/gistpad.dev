import { useCallback, useEffect, useState } from "react"
import { gcOldCollapsedData, loadCollapsedIds, saveCollapsedIds } from "./storage"

export function useCollapsedComments(queryKey: any[], isOpen: boolean) {
  const [collapsedIds, setCollapsedIds] = useState<string[]>([])

  useEffect(() => {
    if (isOpen) {
      gcOldCollapsedData()
      const savedIds = loadCollapsedIds(queryKey)
      setCollapsedIds(savedIds)
    }
  }, [isOpen, queryKey])

  const handleToggleCollapse = useCallback((id: string, collapsed: boolean) => {
    setCollapsedIds(prevIds => {
      const newIds = collapsed
        ? [...prevIds, id]
        : prevIds.filter(cId => cId !== id)

      saveCollapsedIds(queryKey, newIds)
      return newIds
    })
  }, [queryKey])

  const isCollapsed = useCallback((id: string) => {
    return collapsedIds.includes(id)
  }, [collapsedIds])

  return {
    collapsedIds,
    isCollapsed,
    handleToggleCollapse
  }
}