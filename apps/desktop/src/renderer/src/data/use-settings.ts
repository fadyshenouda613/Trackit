import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { UpdateSettingsInput } from '@trackit/shared/schemas'
import { ledger } from '../bridge'
import { keys } from './keys'
import { call } from './result'

export const useSettings = () =>
  useQuery({
    queryKey: keys.settings,
    queryFn: () => call(() => ledger.data.settings.get())
  })

export function useUpdateSettings() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (patch: UpdateSettingsInput) => call(() => ledger.data.settings.update(patch)),
    onSuccess: () =>
      Promise.all([
        client.invalidateQueries({ queryKey: keys.settings }),
        client.invalidateQueries({ queryKey: keys.sync.pending })
      ]).then(() => undefined)
  })
}
