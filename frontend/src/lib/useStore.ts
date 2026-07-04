import { useSyncExternalStore } from 'react'
import { getStudentData, subscribe, StudentData } from './store'

export function useStore(): StudentData {
  return useSyncExternalStore(subscribe, getStudentData, getStudentData)
}
