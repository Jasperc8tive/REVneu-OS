import { Test } from '@nestjs/testing'
import { EventEmitter2, EventEmitterModule } from '@nestjs/event-emitter'
import { Logger } from '@nestjs/common'
import { BillingNotificationsListener } from './billing-notifications.listener'

describe('BillingNotificationsListener', () => {
  it('wires billing.payment.failed events to listener handler', async () => {
    const warnSpy = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined)

    const moduleRef = await Test.createTestingModule({
      imports: [EventEmitterModule.forRoot()],
      providers: [BillingNotificationsListener],
    }).compile()

    await moduleRef.init()

    const eventEmitter = moduleRef.get(EventEmitter2)

    await eventEmitter.emitAsync('billing.payment.failed', {
      organizationId: 'org-1',
      provider: 'stripe',
      providerReference: 'evt_123',
      graceEndsAt: new Date().toISOString(),
    })

    expect(warnSpy).toHaveBeenCalledTimes(1)

    warnSpy.mockRestore()
    await moduleRef.close()
  })
})
