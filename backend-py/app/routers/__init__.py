from .products import router as products_router
from .recipes import router as recipes_router
from .inventory import router as inventory_router
from .brew_logs import router as brew_logs_router
from .brew_notes import router as brew_notes_router
from .posts import router as posts_router
from .roasters import router as roasters_router
from .reviews import router as reviews_router
from .processes import router as processes_router

__all__ = [
    "products_router",
    "recipes_router",
    "inventory_router",
    "brew_logs_router",
    "brew_notes_router",
    "posts_router",
    "roasters_router",
    "reviews_router",
    "processes_router",
]
