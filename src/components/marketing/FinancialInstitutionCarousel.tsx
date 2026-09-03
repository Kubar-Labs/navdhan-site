import Image from "next/image";
import styles from "./navdhan-marketing.module.css";

const financialInstitutions = [
  ["HDFC Bank", "hdfc-bank.svg"],
  ["ICICI Bank", "icici-bank.svg"],
  ["SMFG India Credit", "smfg-india-credit.svg"],
  ["Tata Capital", "tata-capital.svg"],
  ["Kotak Mahindra Bank", "kotak-mahindra-bank.svg"],
  ["IDFC FIRST Bank", "idfc-first-bank.svg"],
  ["Axis Bank", "axis-bank.svg"],
  ["Axis Finance", "axis-finance.svg"],
  ["Aditya Birla Finance", "aditya-birla-finance.svg"],
  ["Standard Chartered", "standard-chartered.svg"],
  ["YES BANK", "yes-bank.svg"],
  ["Hero FinCorp", "hero-fincorp.svg"],
  ["Lendingkart", "lendingkart.svg"],
  ["UGRO Capital", "ugro-capital.svg"],
  ["Deutsche Bank", "deutsche-bank.svg"],
  ["Bajaj Finance", "bajaj-finance.svg"],
  ["Godrej Capital", "godrej-capital.svg"],
  ["Protium", "protium.svg"],
  ["Federal Bank", "federal-bank.svg"],
  ["IIFL Finance", "iifl-finance.svg"],
  ["NeoGrowth", "neogrowth.svg"],
  ["Ashv Finance", "ashv-finance.svg"],
  ["MAS Financial Services", "mas-financial-services.svg"],
  ["Cholamandalam Investment and Finance", "cholamandalam-finance.svg"],
  ["IndusInd Bank", "indusind-bank.svg"],
  ["L&T Finance", "lt-finance.svg"],
  ["Credit Saison India", "credit-saison-india.svg"],
  ["Clix Capital", "clix-capital.svg"],
  ["Shriram Finance", "shriram-finance.svg"],
  ["Unity Small Finance Bank", "unity-small-finance-bank.svg"],
  ["Ambit Finvest", "ambit-finvest.svg"],
  ["Arka Fincap", "arka-fincap.svg"],
  ["Piramal Finance", "piramal-finance.svg"],
  ["Edelweiss", "edelweiss.svg"],
  ["Mahindra Finance", "mahindra-finance.svg"],
  ["SBM Bank India", "sbm-bank-india.svg"],
] as const;

const disclosure =
  "Product availability, eligibility, pricing and approval are determined by the respective financial institution, made available to us through third-party partnerships instead of direct integrations";

function InstitutionList({ duplicate = false }: { duplicate?: boolean }) {
  return (
    <ul
      aria-hidden={duplicate || undefined}
      aria-label={duplicate ? undefined : "Financial institutions"}
      className={styles.lenderCarouselSequence}
    >
      {financialInstitutions.map(([name, asset]) => (
        <li className={styles.lenderLogoTile} key={`${duplicate ? "duplicate-" : ""}${name}`}>
          <Image
            aria-hidden="true"
            className={styles.lenderLogo}
            src={`/assets/financial-institutions/${asset}`}
            alt=""
            width={80}
            height={48}
            loading="eager"
            sizes="80px"
          />
          <span className={styles.srOnly}>{name}</span>
        </li>
      ))}
    </ul>
  );
}

export function FinancialInstitutionCarousel() {
  return (
    <section className={styles.lenderCarousel} aria-labelledby="financial-institutions-heading">
      <div className={styles.lenderCarouselInner}>
        <h2 id="financial-institutions-heading">
          Explore business credit from leading financial institutions
        </h2>
        <div
          className={styles.lenderCarouselViewport}
          aria-label="Financial institution logos. Scroll horizontally to explore."
          tabIndex={0}
        >
          <div className={styles.lenderCarouselTrack}>
            <InstitutionList />
            <InstitutionList duplicate />
          </div>
        </div>
        <p className={styles.lenderDisclosure}>{disclosure}</p>
      </div>
    </section>
  );
}
