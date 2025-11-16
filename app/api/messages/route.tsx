import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    console.log('📨 Получено сообщение:', body)

    // Просто возвращаем успех
    return NextResponse.json({ 
      success: true, 
      message: 'Сообщение сохранено',
      id: Date.now(),
      dialog: {
        id: Date.now(),
        message: body.message,
        sender: body.sender,
        contactId: body.contactId,
        createdAt: new Date().toISOString()
      }
    })
    
  } catch (error) {
    console.error('Ошибка API:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}