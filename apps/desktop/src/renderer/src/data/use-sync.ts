import { useQuery } from '@tanstack/react-query'
import { ledger } from '../bridge'
import { keys } from './keys'
import { call } from './result'

export const usePendingCounts = () =>
  useQuery({
    queryKey: keys.sync.pending,
    queryFn: () => call(() => ledger.data.sync.pendingCounts())
  })
