import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import type { AuthStatus, LoginInput, RegisterInput } from '@trackit/shared/schemas'
import { ledger } from '../bridge'
import { keys } from './keys'
import { call } from './result'

/**
 * The account status: read once, then kept current by main's pushes, the
 * way the update status is. A sign-in or sign-out answers with the new
 * status over the same channel, so the mutations below have nothing to
 * write into the cache themselves.
 */
export function useAuthStatus() {
  const client = useQueryClient()
  useEffect(
    () => ledger.auth.onChanged((status: AuthStatus) => client.setQueryData(keys.auth, status)),
    [client]
  )
  return useQuery({
    queryKey: keys.auth,
    queryFn: () => call(() => ledger.auth.status()),
    staleTime: Infinity
  })
}

/*
 * `silent`: the card states a refusal beneath the field, in its own words,
 * so the mutation cache must not also raise it as a toast.
 */
export function useLogin() {
  return useMutation({
    mutationFn: (input: LoginInput) => call(() => ledger.auth.login(input)),
    meta: { silent: true }
  })
}

export function useRegister() {
  return useMutation({
    mutationFn: (input: RegisterInput) => call(() => ledger.auth.register(input)),
    meta: { silent: true }
  })
}

export function useLogout() {
  return useMutation({ mutationFn: () => call(() => ledger.auth.logout()) })
}
