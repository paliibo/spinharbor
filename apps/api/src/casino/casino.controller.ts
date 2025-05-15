import { Controller, Get, Param, Post } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { GameListQuerySchema, type GameListQuery } from '@spinharbor/contracts';
import { AuthPrincipal, CurrentUser, Public, ROLE_RANK } from '../common/decorators/auth.decorators';
import { ApiZodQuery, ZodQuery } from '../common/zod/zod.decorators';
import { CatalogueService } from './catalogue.service';

@ApiTags('casino')
@Controller('casino')
export class CasinoController {
  constructor(private readonly catalogue: CatalogueService) {}

  @Public()
  @Get('games')
  @ApiOperation({ summary: 'Search / filter / sort the game catalogue' })
  @ApiZodQuery(GameListQuerySchema)
  list(@ZodQuery(GameListQuerySchema) q: GameListQuery, @CurrentUser() user?: AuthPrincipal) {
    return this.catalogue.list(q, user?.id, !!user && ROLE_RANK[user.role] >= ROLE_RANK.SUPPORT);
  }

  @Public()
  @Get('games/:slug')
  @ApiOperation({ summary: 'Game detail with 24h stats' })
  detail(@Param('slug') slug: string, @CurrentUser() user?: AuthPrincipal) {
    return this.catalogue.bySlug(slug, user?.id);
  }

  @Public()
  @Get('categories')
  categories() {
    return this.catalogue.categories();
  }

  @Public()
  @Get('providers')
  providers() {
    return this.catalogue.providers();
  }

  @Public()
  @Get('home')
  @ApiOperation({ summary: 'Home page sections (featured, popular, new, recent, recommended)' })
  home(@CurrentUser() user?: AuthPrincipal) {
    return this.catalogue.home(user?.id);
  }

  @Get('favorites')
  @ApiCookieAuth()
  favorites(@CurrentUser() user: AuthPrincipal) {
    return this.catalogue.favorites(user.id);
  }

  @Post('favorites/:slug/toggle')
  @ApiCookieAuth()
  toggleFavorite(@CurrentUser() user: AuthPrincipal, @Param('slug') slug: string) {
    return this.catalogue.toggleFavorite(user.id, slug);
  }

  @Get('recent')
  @ApiCookieAuth()
  recent(@CurrentUser() user: AuthPrincipal) {
    return this.catalogue.recentList(user.id);
  }
}
