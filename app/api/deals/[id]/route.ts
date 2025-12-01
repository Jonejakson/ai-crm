import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser, getUserId } from "@/lib/get-session";
import { getDirectWhereCondition } from "@/lib/access-control";
import { validateRequest, updateDealSchema } from "@/lib/validation";
import { z } from "zod";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const dealId = parseInt(id);
    if (isNaN(dealId)) {
      return NextResponse.json({ error: "Invalid deal ID" }, { status: 400 });
    }

    const whereCondition = await getDirectWhereCondition();

    const deal = await prisma.deal.findFirst({
      where: {
        id: dealId,
        ...whereCondition,
      },
      include: {
        contact: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            company: true,
            position: true,
          }
        },
        pipeline: {
          select: {
            id: true,
            name: true,
          }
        },
        source: {
          select: {
            id: true,
            name: true,
          }
        },
        dealType: {
          select: {
            id: true,
            name: true,
          }
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          }
        }
      },
    });

    if (!deal) {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    }

    return NextResponse.json(deal);
  } catch (error: any) {
    console.error('Error fetching deal:', error);
    return NextResponse.json({ 
      error: process.env.NODE_ENV === 'development' 
        ? `Error: ${error.message}` 
        : "Internal Server Error" 
    }, { status: 500 });
  }
}

