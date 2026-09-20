export type SecureStorageGetResult = {
  value: string | null
}

export interface SecureStoragePlugin {
  get(options: { key: string }): Promise<SecureStorageGetResult>
  set(options: { key: string; value: string }): Promise<void>
  remove(options: { key: string }): Promise<void>
}
