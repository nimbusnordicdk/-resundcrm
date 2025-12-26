'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Card,
  CardContent,
  Button,
  Modal,
  ModalFooter,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableEmpty,
  Badge,
} from '@/components/ui'
import {
  Plus,
  Search,
  Download,
  Trash2,
  Eye,
  FileText,
  Image as ImageIcon,
  File as FileIcon,
  X,
} from 'lucide-react'
import toast from 'react-hot-toast'
import type { File as FileType, FileVisibility } from '@/types/database'

export default function FilerPage() {
  const [files, setFiles] = useState<FileType[]>([])
  const [loading, setLoading] = useState(true)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [showPreviewModal, setShowPreviewModal] = useState(false)
  const [previewFile, setPreviewFile] = useState<FileType | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [visibility, setVisibility] = useState<FileVisibility>('intern')
  const [submitting, setSubmitting] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    fetchFiles()
  }, [])

  async function fetchFiles() {
    const { data, error } = await supabase
      .from('files')
      .select(`
        *,
        uploader:users!files_uploaded_by_fkey(full_name)
      `)
      .order('created_at', { ascending: false })

    if (error) {
      toast.error('Kunne ikke hente filer')
    } else {
      setFiles(data || [])
    }
    setLoading(false)
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault()
    if (!uploadFile) return

    setSubmitting(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()

      // Upload fil
      const fileExt = uploadFile.name.split('.').pop()
      const fileName = `${Date.now()}-${uploadFile.name}`
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('files')
        .upload(fileName, uploadFile)

      if (uploadError) throw uploadError

      const { data: urlData } = supabase.storage
        .from('files')
        .getPublicUrl(fileName)

      // Gem fil info i database
      const { error: dbError } = await supabase.from('files').insert({
        name: uploadFile.name,
        file_url: urlData.publicUrl,
        file_type: uploadFile.type,
        file_size: uploadFile.size,
        visibility,
        uploaded_by: user?.id,
      })

      if (dbError) throw dbError

      toast.success('Fil uploadet!')
      setShowUploadModal(false)
      setUploadFile(null)
      setVisibility('intern')
      fetchFiles()
    } catch (error: any) {
      toast.error(error.message || 'Kunne ikke uploade fil')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(file: FileType) {
    if (!confirm('Er du sikker på at du vil slette denne fil?')) return

    try {
      // Slet fra storage
      const fileName = file.file_url.split('/').pop()
      await supabase.storage.from('files').remove([fileName!])

      // Slet fra database
      await supabase.from('files').delete().eq('id', file.id)

      toast.success('Fil slettet!')
      fetchFiles()
    } catch (error) {
      toast.error('Kunne ikke slette fil')
    }
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

  function getVisibilityBadge(vis: FileVisibility) {
    switch (vis) {
      case 'admin':
        return <Badge variant="danger">Kun Admin</Badge>
      case 'intern':
        return <Badge variant="warning">Intern Øresund</Badge>
      case 'offentlig':
        return <Badge variant="success">Offentlig</Badge>
    }
  }

  const filteredFiles = files.filter((f) =>
    f.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Filer</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Administrer delte filer</p>
        </div>
        <Button
          icon={<Plus className="w-4 h-4" />}
          onClick={() => setShowUploadModal(true)}
        >
          Upload Fil
        </Button>
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
              <TableHead>Synlighed</TableHead>
              <TableHead>Uploadet af</TableHead>
              <TableHead>Dato</TableHead>
              <TableHead>Handlinger</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
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
                    <TableCell>{getVisibilityBadge(file.visibility)}</TableCell>
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
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<Trash2 className="w-4 h-4 text-danger" />}
                          onClick={() => handleDelete(file)}
                          title="Slet"
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

      {/* Upload Modal */}
      <Modal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        title="Upload Fil"
        size="md"
      >
        <form onSubmit={handleUpload} className="space-y-4">
          <div>
            <label className="label">Vælg Fil</label>
            <input
              type="file"
              onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
              className="input py-2"
              required
            />
          </div>

          <div>
            <label className="label">Synlighed</label>
            <select
              className="input"
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as FileVisibility)}
            >
              <option value="admin">Kun Admin</option>
              <option value="intern">Intern Øresund (Sælgere + Admin)</option>
              <option value="offentlig">Offentlig (Alle inkl. Bureauer)</option>
            </select>
          </div>

          <ModalFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowUploadModal(false)}
            >
              Annuller
            </Button>
            <Button type="submit" loading={submitting}>
              Upload
            </Button>
          </ModalFooter>
        </form>
      </Modal>

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
            <div className="text-center text-gray-500 dark:text-gray-400">
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
