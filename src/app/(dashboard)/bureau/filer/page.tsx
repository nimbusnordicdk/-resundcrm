'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Card,
  CardContent,
  Button,
  Modal,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableEmpty,
} from '@/components/ui'
import {
  Search,
  Download,
  Eye,
  FileText,
  Image as ImageIcon,
  File as FileIcon,
} from 'lucide-react'
import type { File as FileType } from '@/types/database'

export default function BureauFilerPage() {
  const [files, setFiles] = useState<FileType[]>([])
  const [loading, setLoading] = useState(true)
  const [showPreviewModal, setShowPreviewModal] = useState(false)
  const [previewFile, setPreviewFile] = useState<FileType | null>(null)
  const [searchTerm, setSearchTerm] = useState('')

  const supabase = createClient()

  useEffect(() => {
    fetchFiles()
  }, [])

  async function fetchFiles() {
    // Bureau kan kun se offentlige filer
    const { data, error } = await supabase
      .from('files')
      .select(`
        *,
        uploader:users!files_uploaded_by_fkey(full_name)
      `)
      .eq('visibility', 'offentlig')
      .order('created_at', { ascending: false })

    if (!error) {
      setFiles(data || [])
    }
    setLoading(false)
  }

  function openPreview(file: FileType) {
    setPreviewFile(file)
    setShowPreviewModal(true)
  }

  function formatFileSize(bytes: number) {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  function getFileIcon(type: string) {
    if (type.startsWith('image/')) return ImageIcon
    if (type === 'application/pdf') return FileText
    return FileIcon
  }

  const filteredFiles = files.filter((f) =>
    f.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Filer</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Delte filer fra Øresund Partners</p>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="py-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Søg efter fil..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fil</TableHead>
              <TableHead>Størrelse</TableHead>
              <TableHead>Uploadet af</TableHead>
              <TableHead>Dato</TableHead>
              <TableHead>Handlinger</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8">
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-5 h-5 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
                    Indlæser...
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredFiles.length === 0 ? (
              <TableEmpty message="Ingen filer fundet" />
            ) : (
              filteredFiles.map((file: any) => {
                const Icon = getFileIcon(file.file_type)
                return (
                  <TableRow key={file.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-dark-hover flex items-center justify-center">
                          <Icon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                        </div>
                        <span className="font-medium text-gray-900 dark:text-white truncate max-w-[200px]">
                          {file.name}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>{formatFileSize(file.file_size)}</TableCell>
                    <TableCell>{file.uploader?.full_name || '-'}</TableCell>
                    <TableCell>
                      {new Date(file.created_at).toLocaleDateString('da-DK')}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<Eye className="w-4 h-4" />}
                          onClick={() => openPreview(file)}
                          title="Forhåndsvis"
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<Download className="w-4 h-4" />}
                          onClick={() => window.open(file.file_url, '_blank')}
                          title="Download"
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Preview Modal */}
      <Modal
        isOpen={showPreviewModal}
        onClose={() => setShowPreviewModal(false)}
        title={previewFile?.name || 'Forhåndsvisning'}
        size="xl"
      >
        <div className="min-h-[400px] flex items-center justify-center">
          {previewFile?.file_type.startsWith('image/') ? (
            <img
              src={previewFile.file_url}
              alt={previewFile.name}
              className="max-w-full max-h-[500px] object-contain"
            />
          ) : previewFile?.file_type === 'application/pdf' ? (
            <iframe
              src={previewFile.file_url}
              className="w-full h-[500px]"
              title={previewFile.name}
            />
          ) : (
            <div className="text-center text-gray-400">
              <FileIcon className="w-16 h-16 mx-auto mb-4" />
              <p>Forhåndsvisning ikke tilgængelig for denne filtype</p>
              <Button
                variant="primary"
                className="mt-4"
                onClick={() => window.open(previewFile?.file_url, '_blank')}
              >
                Download Fil
              </Button>
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}
