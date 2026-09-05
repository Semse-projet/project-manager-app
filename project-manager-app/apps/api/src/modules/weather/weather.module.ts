import { Module } from '@nestjs/common';
import { WeatherService } from './weather.service.js';
import { WeatherController } from './weather.controller.js';
import { TomorrowWeatherClient, createTomorrowWeatherClient } from '../../integrations/tomorrow-weather.js';

@Module({
  controllers: [WeatherController],
  providers: [
    WeatherService,
    {
      provide: TomorrowWeatherClient,
      useFactory: () => {
        // Usar mock si TOMORROW_API_KEY no está configurada — nunca llamar
        // a la API real de pago sin una key explícita.
        const useMock = !process.env.TOMORROW_API_KEY;
        if (useMock) {
          console.log('[Weather] Using MockTomorrowWeatherClient (TOMORROW_API_KEY not set)');
        }
        return createTomorrowWeatherClient(process.env.TOMORROW_API_KEY || '', useMock);
      },
    },
  ],
  exports: [WeatherService],
})
export class WeatherModule {}
