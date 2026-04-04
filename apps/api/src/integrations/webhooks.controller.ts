import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common'
import { createHmac, timingSafeEqual } from 'crypto'
import type { Request } from 'express'
import Stripe from 'stripe'

@Controller('integrations/webhooks')
export class IntegrationWebhooksController {
  @Post('paystack')
  @HttpCode(200)
  async paystackWebhook(
    @Req() req: Request & { rawBody?: Buffer },
    @Headers('x-paystack-signature') signature?: string,
  ) {
    const webhookSecret = process.env.PAYSTACK_WEBHOOK_SECRET
    if (!webhookSecret) {
      throw new BadRequestException('PAYSTACK_WEBHOOK_SECRET is not configured')
    }

    if (!signature) {
      throw new UnauthorizedException('Missing Paystack signature')
    }

    const payload = req.rawBody?.toString('utf8') ?? JSON.stringify(req.body ?? {})
    const digest = createHmac('sha512', webhookSecret).update(payload).digest('hex')

    const digestBuffer = Buffer.from(digest, 'hex')
    const signatureBuffer = Buffer.from(signature, 'hex')

    if (
      digestBuffer.length !== signatureBuffer.length
      || !timingSafeEqual(digestBuffer, signatureBuffer)
    ) {
      throw new UnauthorizedException('Invalid Paystack signature')
    }

    return { received: true }
  }

  @Post('stripe')
  @HttpCode(200)
  async stripeWebhook(
    @Req() req: Request & { rawBody?: Buffer },
    @Headers('stripe-signature') signature?: string,
  ) {
    const secretKey = process.env.STRIPE_SECRET_KEY
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET

    if (!secretKey || !endpointSecret) {
      throw new BadRequestException('Stripe webhook secrets are not configured')
    }

    if (!signature) {
      throw new UnauthorizedException('Missing Stripe signature')
    }

    const payload = req.rawBody?.toString('utf8') ?? JSON.stringify(req.body ?? {})
    const stripe = new Stripe(secretKey)

    try {
      stripe.webhooks.constructEvent(payload, signature, endpointSecret)
    } catch {
      throw new UnauthorizedException('Invalid Stripe signature')
    }

    return { received: true }
  }
}
