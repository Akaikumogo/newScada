import { useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Download, Upload, Database, FileWarning, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { backupApi } from '@/lib/api'

export function BackupPage() {
  const [downloading, setDownloading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [lastResult, setLastResult] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleDownload() {
    setDownloading(true)
    try {
      const name = await backupApi.download()
      toast.success(`Yuklab olindi: ${name}`)
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.message || 'Yuklab olishda xato'
      toast.error(String(msg))
    } finally {
      setDownloading(false)
    }
  }

  async function handleUpload() {
    if (!file) {
      toast.error('Avval fayl tanlang')
      return
    }
    if (!confirm(
      `DIQQAT!\n\n"${file.name}" faylidan tiklash hozirgi bazadagi barcha ma'lumotlarni qayta yozadi.\n\nDavom etamizmi?`,
    )) return

    setUploading(true)
    setLastResult(null)
    try {
      const r = await backupApi.upload(file)
      const kb = (r.restored_bytes / 1024).toFixed(1)
      setLastResult(`Muvaffaqiyatli: ${r.filename} (${kb} KB)`)
      toast.success('Baza tiklandi')
      setFile(null)
      if (inputRef.current) inputRef.current.value = ''
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.message || 'Tiklashda xato'
      toast.error(String(msg))
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-5 py-8">
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="flex items-center gap-3 mb-7"
      >
        <div className="w-10 h-10 rounded-xl bg-[var(--brand-bg)] flex items-center justify-center">
          <Database size={18} className="text-[var(--brand)]" />
        </div>
        <div>
          <h1 className="text-[18px] font-bold text-[var(--text)]">Baza zaxirasi</h1>
          <p className="text-[12px] text-[var(--text-secondary)]">PostgreSQL bazasini yuklab olish va tiklash</p>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Download */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
          className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] p-6 shadow-[var(--shadow-card)]"
        >
          <div className="flex items-center gap-2.5 mb-2">
            <Download size={16} className="text-[var(--brand)]" />
            <h2 className="text-[14px] font-semibold text-[var(--text)]">Yuklab olish</h2>
          </div>
          <p className="text-[12px] text-[var(--text-secondary)] mb-5 leading-relaxed">
            Joriy bazaning to'liq dump-ini (<span className="font-mono">.dump</span>) yuklab oling.
            Faylni keyinroq boshqa serverga yuklash uchun saqlang.
          </p>
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="w-full h-10 rounded-lg bg-[var(--brand)] text-white text-[13px] font-semibold hover:opacity-90 disabled:opacity-60 transition-opacity flex items-center justify-center gap-2"
          >
            <Download size={14} />
            {downloading ? 'Tayyorlanmoqda…' : 'Backup yuklab olish'}
          </button>
        </motion.div>

        {/* Upload */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] p-6 shadow-[var(--shadow-card)]"
        >
          <div className="flex items-center gap-2.5 mb-2">
            <Upload size={16} className="text-[var(--brand)]" />
            <h2 className="text-[14px] font-semibold text-[var(--text)]">Serverga yuklash</h2>
          </div>
          <p className="text-[12px] text-[var(--text-secondary)] mb-4 leading-relaxed">
            Dump faylini tanlang va serverga tiklang. Hozirgi ma'lumotlar qayta yoziladi.
          </p>

          <label className="block mb-4">
            <input
              ref={inputRef}
              type="file"
              accept=".dump,.sql,.backup"
              onChange={e => setFile(e.target.files?.[0] || null)}
              className="block w-full text-[12px] text-[var(--text-secondary)] file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-[var(--brand-bg)] file:text-[var(--brand)] file:text-[12px] file:font-semibold hover:file:opacity-80"
            />
          </label>

          {file && (
            <div className="mb-4 flex items-center gap-2 text-[12px] text-[var(--text-secondary)] bg-[var(--bg-page)] rounded-lg px-3 py-2 border border-[var(--border)]">
              <FileWarning size={13} className="text-amber-500 flex-shrink-0" />
              <span className="truncate">{file.name}</span>
              <span className="text-[11px] flex-shrink-0">({(file.size / 1024).toFixed(1)} KB)</span>
            </div>
          )}

          <button
            onClick={handleUpload}
            disabled={uploading || !file}
            className="w-full h-10 rounded-lg bg-[var(--brand)] text-white text-[13px] font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center gap-2"
          >
            <Upload size={14} />
            {uploading ? 'Tiklanmoqda…' : 'Serverga yuklash'}
          </button>

          {lastResult && (
            <div className="mt-4 flex items-center gap-2 text-[12px] text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg px-3 py-2 border border-emerald-200 dark:border-emerald-900">
              <CheckCircle2 size={13} />
              <span>{lastResult}</span>
            </div>
          )}
        </motion.div>
      </div>

      <p className="mt-6 text-[11px] text-[var(--text-secondary)] text-center">
        Format: <span className="font-mono">.dump</span> (pg_dump -F c) yoki <span className="font-mono">.sql</span>
      </p>
    </div>
  )
}
