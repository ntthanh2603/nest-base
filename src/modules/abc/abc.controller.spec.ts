import { Test, TestingModule } from '@nestjs/testing';
import { AbcController } from './abc.controller';
import { AbcService } from './abc.service';

describe('AbcController', () => {
  let controller: AbcController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AbcController],
      providers: [AbcService],
    }).compile();

    controller = module.get<AbcController>(AbcController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
