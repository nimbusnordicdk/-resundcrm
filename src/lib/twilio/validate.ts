import twilio from 'twilio'
import { NextRequest } from 'next/server'

/**
 * Validates that a request came from Twilio by checking the X-Twilio-Signature header
 * @param request The incoming request
 * @param body The form data body as a string for signature validation
 * @returns true if the request is valid, false otherwise
 */
export async function validateTwilioRequest(
  request: NextRequest,
  formData: FormData
): Promise<boolean> {
  const authToken = process.env.TWILIO_AUTH_TOKEN

  if (!authToken) {
    console.error('TWILIO_AUTH_TOKEN not configured')
    return false
  }

  // Get the Twilio signature from the header
  const signature = request.headers.get('X-Twilio-Signature')

  if (!signature) {
    console.error('Missing X-Twilio-Signature header')
    return false
  }

  // Get the full URL of the request
  const url = request.url

  // Convert FormData to object for validation
  const params: Record<string, string> = {}
  formData.forEach((value, key) => {
    params[key] = value.toString()
  })

  // Validate the request
  const isValid = twilio.validateRequest(authToken, signature, url, params)

  if (!isValid) {
    console.error('Invalid Twilio signature')
  }

  return isValid
}
