import { useCallback } from 'react'

interface ErrorAlertProps {
  message: string
  onDismiss: () => void
}

export default function ErrorAlert({ message, onDismiss }: ErrorAlertProps) {
  const handleDismiss = useCallback(() => {
    onDismiss()
  }, [onDismiss])

  return (
    <div className="error-alert">
      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-semibold text-red-900">生成失败</h3>
        <p className="mt-1 break-words text-sm leading-relaxed text-red-800">{message}</p>
      </div>
      <button
        onClick={handleDismiss}
        className="rounded-md px-2 py-1 text-xs font-medium text-red-800 transition hover:bg-red-100"
        aria-label="关闭错误提示"
      >
        关闭
      </button>
    </div>
  )
}
