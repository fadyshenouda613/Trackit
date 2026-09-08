import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { TimerScenario } from '@trackit/shared/api'
import { ledger } from '../bridge'
import { call } from './result'

export function useDevReset() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: () => call(() => ledger.dev.reset()),
    onSuccess: () => client.invalidateQueries()
  })
}

export function useDevSeed() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (options?: { reset?: boolean }) => call(() => ledger.dev.seed(options)),
    onSuccess: () => client.invalidateQueries()
  })
}

export function useDevTimerScenario() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (scenario: TimerScenario) => call(() => ledger.dev.timerScenario(scenario)),
    onSuccess: () => client.invalidateQueries()
  })
}
