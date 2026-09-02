import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { Counter, CounterSchema } from './counter.schema';
import { CounterService } from './counter.service';

@Global()
@Module({
  imports: [MongooseModule.forFeature([{ name: Counter.name, schema: CounterSchema }])],
  providers: [CounterService],
  exports: [CounterService],
})
export class CounterModule {}
