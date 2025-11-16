import { NextResponse } from 'next/server'
import prisma from "@/lib/prisma";

export async function GET() {
  const contacts = await prisma.contact.findMany({
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(contacts)
}

export async function POST(req: Request) {
  const data = await req.json()
  const contact = await prisma.contact.create({
    data: {
      name: data.name,
      email: data.email,
      phone: data.phone,
      // notes field removed - not in schema
    },
  })
  return NextResponse.json(contact)
}
