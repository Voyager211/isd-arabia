import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsIn,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

import { SAUDI_REGIONS } from '@isd/shared-types';

export class SubmitQuotationCustomerDto {
  @ApiProperty()
  @IsString()
  @MinLength(2, { message: 'Enter your full name.' })
  @MaxLength(120)
  name: string;

  @ApiProperty()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: 'Enter a valid email address.' })
  @MaxLength(200)
  email: string;

  @ApiProperty()
  @IsString()
  @MinLength(6, { message: 'Enter a contact phone number.' })
  @MaxLength(40)
  phone: string;

  @ApiProperty()
  @IsString()
  @MinLength(2, { message: 'Enter your company name.' })
  @MaxLength(160)
  company: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  designation?: string;
}

export class SubmitQuotationAddressDto {
  @ApiProperty()
  @IsString()
  @MinLength(3, { message: 'Enter the delivery address.' })
  @MaxLength(200)
  line1: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  line2?: string;

  @ApiProperty()
  @IsString()
  @MinLength(2, { message: 'Enter a city.' })
  @MaxLength(120)
  city: string;

  /** Constrained to the thirteen Saudi provinces — the only delivery area. */
  @ApiProperty({ enum: SAUDI_REGIONS })
  @IsIn(SAUDI_REGIONS, { message: 'Choose a region.' })
  region: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  postalCode?: string;

  @ApiPropertyOptional({ default: 'Saudi Arabia' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  country?: string;
}

export class SubmitQuotationItemDto {
  @ApiProperty()
  @IsMongoId({ message: 'Unknown product.' })
  productId: string;

  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1, { message: 'Quantity must be at least 1.' })
  quantity: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

/**
 * Note what the server does NOT accept: name, sku, imageUrl or unit. Those are
 * re-read from the database by the service, so a client cannot dictate what a
 * quotation says a product was (PROJECT_PLAN.md §8.1).
 */
export class SubmitQuotationDto {
  @ApiProperty({ type: SubmitQuotationCustomerDto })
  @ValidateNested()
  @Type(() => SubmitQuotationCustomerDto)
  customer: SubmitQuotationCustomerDto;

  @ApiProperty({ type: SubmitQuotationAddressDto })
  @ValidateNested()
  @Type(() => SubmitQuotationAddressDto)
  address: SubmitQuotationAddressDto;

  @ApiProperty({ type: [SubmitQuotationItemDto] })
  @IsArray()
  @ArrayMinSize(1, { message: 'Add at least one product to your request.' })
  @ArrayMaxSize(200, { message: 'A request can hold at most 200 lines.' })
  @ValidateNested({ each: true })
  @Type(() => SubmitQuotationItemDto)
  items: SubmitQuotationItemDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  message?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  turnstileToken?: string;

  /** Honeypot. Must be empty — see TurnstileService.assertHoneypotEmpty. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  website?: string;
}
