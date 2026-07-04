/**
 * Extraction API client.
 * Tries real backend (localhost:8000) first.
 * Falls back to client-side stub if backend is unavailable.
 */

import { ExtractionResult, stubExtract } from './stubExtractor'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'

export async function extractDocument(file: File): Promise<ExtractionResult> {
  try {
    // Try real backend
    const formData = new FormData()
    formData.append('file', file)

    console.log('[extractApi] Calling backend:', `${API_BASE}/ingest`)
    const res = await fetch(`${API_BASE}/ingest`, {
      method: 'POST',
      body: formData,
    })

    console.log('[extractApi] Response status:', res.status)

    if (!res.ok) {
      throw new Error(`Server returned ${res.status}`)
    }

    const json = await res.json()
    console.log('[extractApi] Response:', json)

    if (json.success && json.extractedData) {
      // Normalize the response to match ExtractionResult shape
      const data = json.extractedData
      return {
        document_type: data.document_type || data.doc_type || 'unknown',
        classes: data.classes || [],
        deadlines: data.deadlines || [],
        notices: data.notices || [],
        menu_items: data.menu_items || [],
        events: data.events || [],
        placements: data.placements || [],
        overall_confidence: data.overall_confidence || 0,
        source_file: file.name,
        raw_text: data.raw_text || '',
      }
    }

    throw new Error('Invalid response format')
  } catch (err) {
    console.error('[extractApi] Backend failed:', err)
    // Fall back to client-side stub
    return stubExtract(file)
  }
}
