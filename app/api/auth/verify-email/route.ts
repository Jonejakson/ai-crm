import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

const getBaseUrl = (req: Request) => {
  try {
    const url = new URL(req.url)
    return `${url.protocol}//${url.host}`
  } catch {
    return process.env.NEXTAUTH_URL || 'http://localhost:3000'
  }
}

/**
 * Подтверждение email по токену
 * GET /api/auth/verify-email?token=xxx
 * Возвращает JSON для fetch или редирект при прямом переходе по ссылке
 */
export async function GET(request: Request) {
  const baseUrl = getBaseUrl(request)
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')
    const redirect = searchParams.get('redirect') !== '0'

    if (!token || token.length < 32) {
      if (redirect) return NextResponse.redirect(`${baseUrl}/login?error=invalid_token`)
      return NextResponse.json({ ok: false, error: 'invalid_token' }, { status: 400 })
    }

    const user = await prisma.user.findFirst({
      where: {
        emailVerificationToken: token,
        emailVerificationExpires: { gt: new Date() },
      },
    })

    if (!user) {
      if (redirect) return NextResponse.redirect(`${baseUrl}/login?error=expired_or_invalid`)
      return NextResponse.json({ ok: false, error: 'expired_or_invalid' }, { status: 400 })
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerifiedAt: new Date(),
        emailVerificationToken: null,
        emailVerificationExpires: null,
      },
    })

    if (redirect) return NextResponse.redirect(`${baseUrl}/login?verified=1`)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[verify-email]', error)
    if (redirect) return NextResponse.redirect(`${baseUrl}/login?error=verify_failed`)
    return NextResponse.json({ ok: false, error: 'verify_failed' }, { status: 500 })
  }
}
