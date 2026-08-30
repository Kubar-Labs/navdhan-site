import Image from "next/image";
import teamData from "@/src/lib/data/team.json";
import { getMessages } from "@/src/lib/i18n/messages";
import { getTeamLocalization } from "@/src/lib/i18n/team-mapper.stub";
import { getTranslator } from "@/src/lib/i18n/translations";
import type { Locale } from "@/src/lib/i18n/config";
import marketingStyles from "./navdhan-marketing.module.css";
import styles from "./team-page.module.css";

type Accent = "green" | "blue" | "orange";

interface ValueItem {
  id: string;
  title: string;
  body: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function localizedValues(locale: Locale): ValueItem[] {
  const messages = getMessages(locale);
  const team = isRecord(messages.team) ? messages.team : {};
  const values = isRecord(team.values) ? team.values : {};
  return Array.isArray(values.items) ? (values.items as ValueItem[]) : [];
}

function HeroPortraitGrid() {
  return (
    <div className={styles.contactSheet}>
      <p>NAVDHAN / TEAM</p>
      <div className={styles.contactSheetRule} />
      <div className={styles.heroPortraitGrid} aria-hidden="true">
        {teamData.members.map((member, index) => (
          <div className={styles.heroPortrait} key={member.id} data-testid="hero-portrait">
            <Image
              src={member.imageAsset}
              alt=""
              fill
              priority={index === 0}
              sizes="(max-width: 900px) 30vw, 197px"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function ValueCard({
  value,
  marker,
  accent,
}: {
  value: ValueItem;
  marker: string;
  accent: Accent;
}) {
  return (
    <article className={`${styles.paperCard} ${styles.valueCard} ${styles[accent]}`}>
      <div className={styles.accentRule} />
      <p className={styles.valueMarker}>{marker}</p>
      <h3>{value.title}</h3>
      <p>{value.body}</p>
    </article>
  );
}

function TeamMemberCard({
  member,
  role,
  biography,
}: {
  member: (typeof teamData.members)[number];
  role: string;
  biography: string;
}) {
  return (
    <article className={`${styles.paperCard} ${styles.memberCard}`}>
      <div className={styles.accentRule} />
      <div className={styles.memberPortrait}>
        <Image
          src={member.imageAsset}
          alt={`Portrait of ${member.name}`}
          fill
          sizes="(max-width: 900px) calc(100vw - 96px), (max-width: 1100px) 29vw, 394px"
        />
      </div>
      <div className={styles.cardCopy}>
        <h3>{member.name}</h3>
        <p className={styles.memberRole}>{role}</p>
        <p className={styles.biography}>{biography}</p>
        <a
          className={styles.profileLink}
          href={member.linkedIn}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${member.name} on LinkedIn (opens in a new tab)`}
        >
          LinkedIn ↗
        </a>
      </div>
    </article>
  );
}

function AdvisorCard({
  advisor,
  domain,
  contribution,
}: {
  advisor: (typeof teamData.advisors)[number];
  domain: string;
  contribution: string;
}) {
  return (
    <article className={`${styles.paperCard} ${styles.advisorCard}`}>
      <div className={styles.advisorMedia}>
        <div className={styles.accentRule} />
        <div className={styles.advisorPortrait}>
          <Image
            src={advisor.imageAsset}
            alt={`Portrait of ${advisor.name}`}
            fill
            sizes="(max-width: 900px) calc(100vw - 96px), 160px"
          />
        </div>
      </div>
      <div className={styles.cardCopy}>
        <h3>
          <a
            href={advisor.linkedIn}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${advisor.name} on LinkedIn (opens in a new tab)`}
          >
            {advisor.name}
          </a>
        </h3>
        <p className={styles.advisorDomain}>{domain}</p>
        <p className={styles.biography}>{contribution}</p>
      </div>
    </article>
  );
}

export async function TeamPage({ locale }: { locale: Locale }) {
  const t = await getTranslator(locale);
  const values = localizedValues(locale);
  const localization = getTeamLocalization(getMessages(locale), locale);
  const valueAccents: Accent[] = ["green", "blue", "orange"];

  return (
    <div className={`${marketingStyles.site} ${styles.page}`}>
      <section className={styles.hero} aria-labelledby="team-page-title">
        <div className={styles.heroInner}>
          <div className={styles.heroCopy}>
            <h1 id="team-page-title">{t("team.hero.heading")}</h1>
            <p className={styles.heroBody}>{t("team.hero.subtext")}</p>
          </div>
          <HeroPortraitGrid />
        </div>
      </section>

      <section
        className={`${styles.section} ${styles.missionSection}`}
        aria-labelledby="mission-title"
      >
        <div className={styles.sectionInner}>
          <div className={styles.missionIntro}>
            <div>
              <h2 id="mission-title">{t("team.mission.heading")}</h2>
            </div>
            <p>{t("team.mission.body")}</p>
          </div>
          <div className={styles.valueGrid}>
            {values.map((value, index) => (
              <ValueCard
                key={value.id}
                value={value}
                marker={String(index + 1).padStart(2, "0")}
                accent={valueAccents[index] ?? "green"}
              />
            ))}
          </div>
        </div>
      </section>

      <section
        className={`${styles.section} ${styles.teamSection}`}
        aria-labelledby="core-team-title"
      >
        <div className={styles.sectionInner}>
          <header className={styles.sectionHeading}>
            <h2 id="core-team-title">{t("team.members.heading")}</h2>
          </header>
          <div className={styles.memberGrid}>
            {teamData.members.map((member) => (
              <TeamMemberCard
                key={member.id}
                member={member}
                role={localization.getMemberCopy(member.id, "role")}
                biography={localization.getMemberCopy(member.id, "bio")}
              />
            ))}
          </div>
        </div>
      </section>

      <section
        className={`${styles.section} ${styles.advisorSection}`}
        aria-labelledby="advisors-title"
      >
        <div className={styles.sectionInner}>
          <header className={styles.sectionHeading}>
            <h2 id="advisors-title">{t("team.advisors.heading")}</h2>
          </header>
          <div className={styles.advisorGrid}>
            {teamData.advisors.map((advisor) => (
              <AdvisorCard
                key={advisor.id}
                advisor={advisor}
                domain={localization.getAdvisorCopy(advisor.id, "domain")}
                contribution={localization.getAdvisorCopy(advisor.id, "contribution")}
              />
            ))}
          </div>
        </div>
      </section>

      <section
        className={`${styles.section} ${styles.careersSection}`}
        aria-labelledby="careers-title"
      >
        <div className={`${styles.paperPanel} ${styles.careersPanel}`}>
          <div className={styles.careersCopy}>
            <h2 id="careers-title">{t("team.join.heading")}</h2>
            <p>{t("team.join.subtext")}</p>
          </div>
          <a
            className={`${marketingStyles.button} ${marketingStyles.primary} ${styles.careersCta}`}
            href={teamData.joinHref}
          >
            {t("team.join.cta")}
            <Image
              aria-hidden
              src="/assets/navdhan-redesign/arrow-light.svg"
              alt=""
              width={18}
              height={18}
            />
          </a>
        </div>
      </section>
    </div>
  );
}
