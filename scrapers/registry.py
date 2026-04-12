"""
Scraper registry — single source of truth for all roasters.

To add a new roaster:
  1. Create a scraper class in scrapers/roasters/ (or add to all_roasters.py)
  2. Add it to ALL_SCRAPERS below.

That's it. The runner picks up everything from this list automatically.
"""
from scrapers.roasters.blue_tokai    import BlueTokaiScraper
from scrapers.roasters.tulum         import TulumScraper
from scrapers.roasters.subko         import SubkoScraper
from scrapers.roasters.araku         import ArakuScraper
from scrapers.roasters.bloom_coffee  import BloomCoffeeScraper
from scrapers.roasters.kappi_kottai  import KappiKottaiScraper
from scrapers.roasters.savorworks    import SavorworksScraper
from scrapers.roasters.quick_brown_fox import QuickBrownFoxScraper
from scrapers.roasters.fraction9     import Fraction9Scraper
from scrapers.roasters.curious_life  import CuriousLifeScraper
from scrapers.roasters.alchemist     import AlchemistScraper
from scrapers.roasters.ainmane       import AinmaneScraper
from scrapers.roasters.ab_coffee     import ABCoffeeScraper
from scrapers.roasters.naivo         import NaivoScraper
from scrapers.roasters.all_roasters  import (
    CaffeineBAarScraper, HumbleExpressScraper, BiliHuScraper,
    CorridorSevenScraper, EstateMonkeyScraper, SilkRoadScraper,
    RossetteScraper, KorebiScraper, KoffeeGeneticsScraper,
    KatAndKinScraper, HomeBlendScraper, SiolimScraper,
    BombayIslandScraper, DopeScraper, GreySoulScraper,
    HunkalHeightsScraper, HalfLightScraper, PandurangeScraper,
    DevansScraper, BlackBazaScraper, CaarabiScraper, VuiScraper,
    SevenBeansScraper, DancingGoatScraper, CoffeeCircusScraper,
    MokkaFarmsScraper, ClassicCoffeeScraper, MaverickAndFarmerScraper,
    CoffeeMechanicsScraper, SevenThousandStepsScraper, BlackPoetry,
    BoojeeScraper, BrootCoffeeScraper, BrownRushScraper,
    CaffinnaryScraper, CoffeeverseScraper, DripfaceScraper,
    FirstCrackScraper, GunchaScraper, HumbleBeanScraper,
    KrutiCoffeeScraper, KupCoffeeScraper, LungoScraper,
    NinetyTwoScraper, OddCoffeeScraper, PotboilerScraper, ToiseScraper,
    RoasteryCoffeeScraper, MarcsCoffeeScraper, FiveFarmsScraper,
    HandcraftedScraper, AgasthyaScraper, BeansOfBodhiScraper,
    DreamHillScraper, ElBuenoScraper, NandanCoffeeScraper,
    SevenElementsScraper, AnecdoteRoastersScraper, EarthCoffeeRoastersScraper,
)


# Ordered list of all scraper classes.
# Each entry instantiated fresh per run.
ALL_SCRAPERS = [
    BlueTokaiScraper,
    TulumScraper,
    SubkoScraper,
    ArakuScraper,
    BloomCoffeeScraper,
    KappiKottaiScraper,
    SavorworksScraper,
    QuickBrownFoxScraper,
    Fraction9Scraper,
    CuriousLifeScraper,
    AlchemistScraper,
    AinmaneScraper,
    ABCoffeeScraper,
    NaivoScraper,
    # ── All remaining roasters ──
    CaffeineBAarScraper,
    HumbleExpressScraper,
    BiliHuScraper,
    CorridorSevenScraper,
    EstateMonkeyScraper,
    SilkRoadScraper,
    RossetteScraper,
    KorebiScraper,
    KoffeeGeneticsScraper,
    KatAndKinScraper,
    HomeBlendScraper,
    SiolimScraper,
    BombayIslandScraper,
    DopeScraper,
    GreySoulScraper,
    HunkalHeightsScraper,
    HalfLightScraper,
    PandurangeScraper,
    DevansScraper,
    BlackBazaScraper,
    CaarabiScraper,
    VuiScraper,
    SevenBeansScraper,
    DancingGoatScraper,
    CoffeeCircusScraper,
    MokkaFarmsScraper,
    ClassicCoffeeScraper,
    MaverickAndFarmerScraper,
    CoffeeMechanicsScraper,
    SevenThousandStepsScraper,
    BlackPoetry,
    BoojeeScraper,
    BrootCoffeeScraper,
    BrownRushScraper,
    CaffinnaryScraper,
    CoffeeverseScraper,
    DripfaceScraper,
    FirstCrackScraper,
    GunchaScraper,
    HumbleBeanScraper,
    KrutiCoffeeScraper,
    KupCoffeeScraper,
    LungoScraper,
    NinetyTwoScraper,
    OddCoffeeScraper,
    PotboilerScraper,
    ToiseScraper,
    RoasteryCoffeeScraper,
    MarcsCoffeeScraper,
    FiveFarmsScraper,
    HandcraftedScraper,
    AgasthyaScraper,
    BeansOfBodhiScraper,
    DreamHillScraper,
    ElBuenoScraper,
    NandanCoffeeScraper,
    SevenElementsScraper,
    AnecdoteRoastersScraper,
    EarthCoffeeRoastersScraper,
]
