/*
 * The two things the printed sheet says that no record holds: the terms as
 * prose, and where the money goes. Both now live in the shared helpers,
 * because the server prints the same sheet as a PDF and has to say exactly
 * what this one says. This module remains as the sheet's own door to them.
 */
export { bank, paymentTermsProse } from '@trackit/shared'
