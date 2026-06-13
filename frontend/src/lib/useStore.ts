import { useState, useEffect } from 'react'
import { getStudentData, subscribe, StudentData } from './store'

/**
 * React hook that re-renders when the store changes.
 */
export function useStore(): StudentData {
  const [data, setData] = useState<StudentData>(getStudentData())

  useEffect(() => {
    // Pick up any changes that happened since mount
    setData({ ...getStudentData() })
    const unsub = subscribe(() => {
      setData({ ...getStudentData() })
    })
    return unsub
  }, [])

  return data
}
