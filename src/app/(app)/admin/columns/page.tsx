import { redirect } from 'next/navigation'

/** Columns moved out of /admin when members were given access to them. */
export default function MovedColumnsPage() {
  redirect('/columns')
}
