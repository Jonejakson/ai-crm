import "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      email: string
      name: string
      role: string
      companyId: string
      companyName?: string
      isLegalEntity?: boolean
    }
  }

  interface User {
    id: string
    email: string
    name: string
    role: string
    companyId: string
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    role: string
    companyId: string
    companyName?: string
    isLegalEntity?: boolean
  }
}



