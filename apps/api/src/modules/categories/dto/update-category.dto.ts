import { PartialType } from '@nestjs/swagger';

import { CreateCategoryDto } from './create-category.dto';

/**
 * Every field optional. `parent` moving is the expensive case — the service
 * rebuilds `ancestors` for the whole subtree and repairs affected products.
 */
export class UpdateCategoryDto extends PartialType(CreateCategoryDto) {}
