import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

// Transcribe recording using OpenAI Whisper
async function transcribeRecording(
  recordingUrl: string,
  accountSid: string,
  authToken: string
): Promise<string | null> {
  try {
    const openaiApiKey = process.env.OPENAI_API_KEY
    if (!openaiApiKey) {
      console.error('OpenAI API key not configured')
      return null
    }

    // Fetch the recording from Twilio with authentication
    const mp3Url = `${recordingUrl}.mp3`
    console.log('Fetching recording from:', mp3Url)

    const response = await fetch(mp3Url, {
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
      },
    })

    if (!response.ok) {
      console.error('Failed to fetch recording:', response.status, response.statusText)
      return null
    }

    const audioBuffer = await response.arrayBuffer()
    console.log('Recording fetched, size:', audioBuffer.byteLength, 'bytes')

    // Create a File object from the buffer
    const audioFile = new File([audioBuffer], 'recording.mp3', { type: 'audio/mpeg' })

    // Transcribe using OpenAI Whisper
    const openai = new OpenAI({ apiKey: openaiApiKey })

    console.log('Starting transcription with Whisper...')
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      language: 'da', // Danish
      response_format: 'text',
      prompt: 'Dette er et dansk salgsopkald. Almindelige danske fraser inkluderer: "Nummeret du ringer til kan ikke modtage opkald lige nu", "Indtalt en besked efter tonen", "Personen du ringer til er ikke tilgængelig", "Hej, du har ringet til", "Læg venligst en besked efter bippet", "Telefonsvareren". Navne og firmanavne kan forekomme.',
    })

    console.log('Transcription completed:', transcription.substring(0, 100) + '...')
    return transcription
  } catch (error) {
    console.error('Transcription error:', error)
    return null
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()

    const callSid = formData.get('CallSid') as string
    const recordingSid = formData.get('RecordingSid') as string
    const recordingUrl = formData.get('RecordingUrl') as string
    const recordingStatus = formData.get('RecordingStatus') as string
    const recordingDuration = formData.get('RecordingDuration') as string

    console.log('Recording status callback:', {
      callSid,
      recordingSid,
      recordingUrl,
      recordingStatus,
      recordingDuration,
    })

    if (recordingStatus === 'completed' && recordingUrl && callSid) {
      // Create Supabase admin client
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
      const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID
      const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN

      if (!supabaseUrl || !supabaseServiceKey) {
        console.error('Supabase credentials not configured')
        return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
      }

      const supabase = createClient(supabaseUrl, supabaseServiceKey)

      // Update call_log with recording URL (add .mp3 for direct playback)
      const { error } = await supabase
        .from('call_logs')
        .update({
          recording_url: `${recordingUrl}.mp3`,
          recording_sid: recordingSid,
        })
        .eq('call_sid', callSid)

      if (error) {
        console.error('Error saving recording URL:', error)
      } else {
        console.log('Recording URL saved for call:', callSid)
      }

      // Transcribe the recording asynchronously (don't block the webhook response)
      if (twilioAccountSid && twilioAuthToken) {
        // Start transcription in background
        transcribeRecording(recordingUrl, twilioAccountSid, twilioAuthToken)
          .then(async (transcript) => {
            if (transcript) {
              const { error: transcriptError } = await supabase
                .from('call_logs')
                .update({
                  transcript,
                  transcript_created_at: new Date().toISOString(),
                })
                .eq('call_sid', callSid)

              if (transcriptError) {
                console.error('Error saving transcript:', transcriptError)
              } else {
                console.log('Transcript saved for call:', callSid)
              }
            }
          })
          .catch((err) => {
            console.error('Background transcription failed:', err)
          })
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Recording status callback error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
