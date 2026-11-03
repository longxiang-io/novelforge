<template>
  <div class="landing lp">
    <header class="nav">
      <div class="wrap nav-inner">
        <router-link class="brand" to="/" :aria-label="$t('brand')">
          <BrandMark />
        </router-link>
        <nav class="nav-links" :aria-label="$t('public.landing.nav.page')">
          <a href="#s1">{{ $t('public.landing.nav.build') }}</a>
          <a href="#s2">{{ $t('public.landing.nav.memory') }}</a>
          <a href="#s3">{{ $t('public.landing.nav.outline') }}</a>
          <a href="#s4">{{ $t('public.landing.nav.write') }}</a>
          <a href="#faq">{{ $t('public.landing.nav.faq') }}</a>
        </nav>
        <nav class="nav-actions" :aria-label="$t('public.landing.nav.account')">
          <LocaleSwitch />
          <router-link class="nav-doc" to="/guide">{{ $t('public.landing.nav.guide') }}</router-link>
          <router-link v-if="loggedIn" class="btn btn-primary" to="/changjuan">{{ $t('public.landing.nav.shelf') }}</router-link>
          <template v-else>
            <router-link class="btn btn-primary" to="/login">{{ $t('public.landing.nav.login') }}</router-link>
            <router-link class="btn btn-secondary" to="/register">{{ $t('public.landing.nav.register') }}</router-link>
          </template>
        </nav>
      </div>
    </header>

    <main>
      <section class="hero">
        <div class="wrap">
          <h1 v-reveal class="rv">{{ $t('public.landing.hero.title1') }}<br><span class="nw">{{ $t('public.landing.hero.title2') }}</span></h1>
          <p v-reveal class="sub rv">{{ $t('public.landing.hero.sub') }}</p>
          <div v-reveal class="actions rv">
            <router-link v-if="loggedIn" class="btn btn-primary btn-lg" to="/changjuan">{{ $t('public.landing.nav.shelf') }}</router-link>
            <template v-else>
              <router-link class="btn btn-primary btn-lg" to="/login">{{ $t('public.landing.nav.login') }}</router-link>
              <router-link class="btn btn-secondary btn-lg" to="/register">{{ $t('public.landing.nav.register') }}</router-link>
            </template>
          </div>

          <div v-reveal class="win hero-demo rv" :aria-label="$t('public.landing.hero.demoLabel')">
            <aside class="side">
              <h4>{{ $t('public.landing.hero.brings') }}</h4>
              <div class="ctx"><s>{{ $t('public.landing.hero.world') }}</s><span>{{ $t('public.landing.hero.worldValue') }}</span></div>
              <div class="ctx c"><s>{{ $t('public.landing.hero.character') }}</s><span>{{ $t('public.landing.hero.shenRole') }}</span></div>
              <div class="ctx c"><s>{{ $t('public.landing.hero.character') }}</s><span>{{ $t('public.landing.hero.wen') }}</span></div>
              <div class="ctx"><s>{{ $t('public.landing.hero.setting') }}</s><span>{{ $t('public.landing.hero.settingValue') }}</span></div>
              <div class="ctx f"><s>{{ $t('public.landing.hero.foreshadow') }}</s><span>{{ $t('public.landing.hero.foreshadowValue') }}</span></div>
              <div class="ctx m"><s>{{ $t('public.landing.hero.summary') }}</s><span>{{ $t('public.landing.hero.summaryValue') }}</span></div>
            </aside>
            <div class="main">
              <div class="steps-bar"><span class="done">{{ $t('public.landing.hero.stepOutline') }}</span><span class="now">{{ $t('public.landing.hero.stepGenerate') }}</span><span>{{ $t('public.landing.hero.stepCheck') }}</span><span>{{ $t('public.landing.hero.stepConfirm') }}</span></div>
              <div class="think">{{ $t('public.landing.hero.thinking') }}</div>
              <div class="prose"><p>{{ typed }}<span class="caret" aria-hidden="true"></span></p></div>
            </div>
            <div class="win-foot">
              <span>{{ $t('public.landing.hero.chapter') }}<span class="tag-demo">{{ $t('public.landing.demo') }}</span></span>
              <span>{{ $t('public.landing.hero.words', { count: wordCount }) }}</span>
              <span class="mini">{{ $t('public.landing.hero.continue') }}</span>
              <span class="mini pri">{{ $t('public.landing.hero.stop') }}</span>
            </div>
          </div>
        </div>
      </section>

      <section class="chapter" id="s1">
        <div class="wrap">
          <div v-reveal class="copy rv">
            <div class="eyebrow"><b>01</b>{{ $t('public.landing.s1.kicker') }}</div>
            <h2>{{ $t('public.landing.s1.title1') }}<br>{{ $t('public.landing.s1.title2') }}</h2>
            <p>{{ $t('public.landing.s1.body') }}</p>
            <ol class="mini-steps">
              <li><em>01</em><div><h3>{{ $t('public.landing.s1.steps.chatTitle') }}</h3><p>{{ $t('public.landing.s1.steps.chatBody') }}</p></div></li>
              <li><em>02</em><div><h3>{{ $t('public.landing.s1.steps.planTitle') }}</h3><p>{{ $t('public.landing.s1.steps.planBody') }}</p></div></li>
              <li><em>03</em><div><h3>{{ $t('public.landing.s1.steps.createTitle') }}</h3><p>{{ $t('public.landing.s1.steps.createBody') }}</p></div></li>
            </ol>
          </div>
          <div v-reveal class="win rv">
            <div class="win-bar"><i></i><i></i><i></i><b>{{ $t('public.landing.s1.bar') }}</b><span class="tag-demo">{{ $t('public.landing.demo') }}</span><em>{{ $t('public.landing.s1.tag') }}</em></div>
            <div class="chat">
              <div class="bubble me">{{ $t('public.landing.s1.me') }}</div>
              <div class="bubble ai">{{ $t('public.landing.s1.ai') }}</div>
              <div class="plan">
                <dl>
                  <dt>{{ $t('public.landing.s1.fields.title') }}</dt><dd>{{ $t('public.landing.s1.fields.titleValue') }}</dd>
                  <dt>{{ $t('public.landing.s1.fields.hero') }}</dt><dd>{{ $t('public.landing.s1.fields.heroValue') }}</dd>
                  <dt>{{ $t('public.landing.s1.fields.conflict') }}</dt><dd>{{ $t('public.landing.s1.fields.conflictValue') }}</dd>
                </dl>
                <div class="row">
                  <button type="button" class="apply" :class="{ ok: applied }" @click="applied = true">{{ applied ? $t('public.landing.s1.applied') : $t('public.landing.s1.apply') }}</button>
                  <span class="note">{{ applied ? $t('public.landing.s1.noteDone') : $t('public.landing.s1.noteIdle') }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="chapter flip" id="s2">
        <div class="wrap">
          <div v-reveal class="copy rv">
            <div class="eyebrow"><b>02</b>{{ $t('public.landing.s2.kicker') }}</div>
            <h2>{{ $t('public.landing.s2.title1') }}<br>{{ $t('public.landing.s2.title2') }}</h2>
            <p>{{ $t('public.landing.s2.body') }}</p>
            <ol class="mini-steps">
              <li><em>01</em><div><h3>{{ $t('public.landing.s2.steps.peopleTitle') }}</h3><p>{{ $t('public.landing.s2.steps.peopleBody') }}</p></div></li>
              <li><em>02</em><div><h3>{{ $t('public.landing.s2.steps.settingTitle') }}</h3><p>{{ $t('public.landing.s2.steps.settingBody') }}</p></div></li>
              <li><em>03</em><div><h3>{{ $t('public.landing.s2.steps.carryTitle') }}</h3><p>{{ $t('public.landing.s2.steps.carryBody') }}</p></div></li>
            </ol>
          </div>
          <div v-reveal class="win rv">
            <div class="win-bar"><i></i><i></i><i></i><b>{{ $t('public.landing.s2.bar') }}</b><span class="tag-demo">{{ $t('public.landing.demo') }}</span><em>{{ $t('public.landing.s2.hint') }}</em></div>
            <div class="cards">
              <div class="card"><h4>{{ $t('public.landing.s2.shenName') }} <span class="k">{{ $t('public.landing.s2.kindCharacter') }}</span></h4><p>{{ $t('public.landing.s2.shenDesc') }}</p><div class="st"><span>{{ $t('public.landing.s2.alive') }}</span><span>{{ $t('public.landing.s2.present') }}</span></div></div>
              <div class="card"><h4>{{ $t('public.landing.s2.luName') }} <span class="k">{{ $t('public.landing.s2.kindCharacter') }}</span></h4><p>{{ $t('public.landing.s2.luDesc') }}</p><div class="st"><span class="warn">{{ $t('public.landing.s2.dead') }}</span><span>{{ $t('public.landing.s2.luNote') }}</span></div></div>
              <div class="card set">
                <h4>{{ $t('public.landing.s2.veinTitle') }} <span class="k">{{ $t('public.landing.s2.kindRule') }}</span></h4>
                <p>{{ $t('public.landing.s2.veinDesc') }}</p>
                <button type="button" class="toggle" :class="{ on: pins.vein }" role="switch" :aria-checked="pins.vein" @click="pins.vein = !pins.vein"><span class="sw" aria-hidden="true"></span>{{ $t('public.landing.s2.pin') }}</button>
              </div>
              <div class="card set">
                <h4>{{ $t('public.landing.s2.sectTitle') }} <span class="k">{{ $t('public.landing.s2.kindFaction') }}</span></h4>
                <p>{{ $t('public.landing.s2.sectDesc') }}</p>
                <button type="button" class="toggle" :class="{ on: pins.sect }" role="switch" :aria-checked="pins.sect" @click="pins.sect = !pins.sect"><span class="sw" aria-hidden="true"></span>{{ $t('public.landing.s2.pin') }}</button>
              </div>
              <div class="inject">
                <b>{{ $t('public.landing.s2.inject') }}</b><br>
                <span>{{ $t('public.landing.s2.injShen') }}</span>
                <span>{{ $t('public.landing.s2.injWen') }}</span>
                <span :class="{ off: !pins.vein }">{{ $t('public.landing.s2.injVein') }}</span>
                <span :class="{ off: !pins.sect }">{{ $t('public.landing.s2.injSect') }}</span>
                <span>{{ $t('public.landing.s2.injSummary') }}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="chapter" id="s3">
        <div class="wrap">
          <div v-reveal class="copy rv">
            <div class="eyebrow"><b>03</b>{{ $t('public.landing.s3.kicker') }}</div>
            <h2>{{ $t('public.landing.s3.title1') }}<br>{{ $t('public.landing.s3.title2') }}</h2>
            <p>{{ $t('public.landing.s3.body') }}</p>
            <ol class="mini-steps">
              <li><em>01</em><div><h3>{{ $t('public.landing.s3.steps.layersTitle') }}</h3><p>{{ $t('public.landing.s3.steps.layersBody') }}</p></div></li>
              <li><em>02</em><div><h3>{{ $t('public.landing.s3.steps.dueTitle') }}</h3><p>{{ $t('public.landing.s3.steps.dueBody') }}</p></div></li>
              <li><em>03</em><div><h3>{{ $t('public.landing.s3.steps.autoTitle') }}</h3><p>{{ $t('public.landing.s3.steps.autoBody') }}</p></div></li>
            </ol>
          </div>
          <div v-reveal class="win rv">
            <div class="win-bar"><i></i><i></i><i></i><b>{{ $t('public.landing.s3.bar') }}</b><span class="tag-demo">{{ $t('public.landing.demo') }}</span><em>{{ $t('public.landing.s3.hint') }}</em></div>
            <div class="fs">
              <div class="slider-row">
                <span>{{ $t('public.landing.s3.writing') }}</span>
                <b>{{ $t('public.landing.s3.chapter', { n: chapter }) }}</b>
                <input v-model.number="chapter" type="range" min="20" max="140" :aria-label="$t('public.landing.s3.range')" />
              </div>
              <div class="fs-list">
                <div v-for="row in foreshadowRows" :key="row.id" class="fs-item" :class="[row.state, { inj: row.injected }]">
                  <span>{{ row.name }}</span>
                  <span class="badge">{{ row.badge }}</span>
                  <small>{{ $t('public.landing.s3.meta', { plant: row.plant, due: row.due }) }}<span v-if="row.who"> · {{ row.who }}</span></small>
                </div>
              </div>
              <div class="fs-foot">{{ $t('public.landing.s3.foot') }}</div>
            </div>
          </div>
        </div>
      </section>

      <section class="chapter flip" id="s4">
        <div class="wrap">
          <div v-reveal class="copy rv">
            <div class="eyebrow"><b>04</b>{{ $t('public.landing.s4.kicker') }}</div>
            <h2>{{ $t('public.landing.s4.title1') }}<br>{{ $t('public.landing.s4.title2') }}</h2>
            <p>{{ $t('public.landing.s4.body') }}</p>
            <ol class="mini-steps">
              <li><em>01</em><div><h3>{{ $t('public.landing.s4.steps.draftTitle') }}</h3><p>{{ $t('public.landing.s4.steps.draftBody') }}</p></div></li>
              <li><em>02</em><div><h3>{{ $t('public.landing.s4.steps.checkTitle') }}</h3><p>{{ $t('public.landing.s4.steps.checkBody') }}</p></div></li>
              <li><em>03</em><div><h3>{{ $t('public.landing.s4.steps.oneTitle') }}</h3><p>{{ $t('public.landing.s4.steps.oneBody') }}</p></div></li>
            </ol>
          </div>
          <div v-reveal class="win rv">
            <div class="win-bar"><i></i><i></i><i></i><b>{{ $t('public.landing.s4.bar') }}</b><span class="tag-demo">{{ $t('public.landing.demo') }}</span><em>{{ $t('public.landing.s4.hint') }}</em></div>
            <div class="ck">
              <div class="prose">
                <p>{{ $t('public.landing.s4.prose.p1.before') }}<mark :class="markClass('should')">{{ $t('public.landing.s4.prose.p1.mark') }}</mark>{{ $t('public.landing.s4.prose.p1.after') }}</p>
                <p>{{ $t('public.landing.s4.prose.p2.before') }}<mark :class="markClass('hint')">{{ $t('public.landing.s4.prose.p2.mark') }}</mark>{{ $t('public.landing.s4.prose.p2.after') }}</p>
                <p>{{ $t('public.landing.s4.prose.p3.before') }}<mark :class="markClass('must')">{{ $t('public.landing.s4.prose.p3.mark') }}</mark>{{ $t('public.landing.s4.prose.p3.after') }}</p>
                <p>{{ $t('public.landing.s4.prose.p4') }}</p>
              </div>
              <div class="issues">
                <button
                  v-for="issue in issues"
                  :key="issue.key"
                  type="button"
                  class="issue"
                  :class="{ on: activeIssue === issue.key }"
                  @mouseenter="activeIssue = issue.key"
                  @focus="activeIssue = issue.key"
                  @click="activeIssue = issue.key"
                >
                  <span class="sev" :class="issue.key">{{ $t(`public.landing.s4.issues.${issue.key}.level`) }}</span>
                  <b>{{ $t(`public.landing.s4.issues.${issue.key}.title`) }}</b>
                  <small>{{ $t(`public.landing.s4.issues.${issue.key}.detail`) }}</small>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="chapter" id="s5">
        <div class="wrap">
          <div v-reveal class="copy rv">
            <div class="eyebrow"><b>05</b>{{ $t('public.landing.s5.kicker') }}</div>
            <h2>{{ $t('public.landing.s5.title1') }}<br>{{ $t('public.landing.s5.title2') }}</h2>
            <p>{{ $t('public.landing.s5.body') }}</p>
            <ol class="mini-steps">
              <li><em>01</em><div><h3>{{ $t('public.landing.s5.steps.pickTitle') }}</h3><p>{{ $t('public.landing.s5.steps.pickBody') }}</p></div></li>
              <li><em>02</em><div><h3>{{ $t('public.landing.s5.steps.sumTitle') }}</h3><p>{{ $t('public.landing.s5.steps.sumBody') }}</p></div></li>
              <li><em>03</em><div><h3>{{ $t('public.landing.s5.steps.lookTitle') }}</h3><p>{{ $t('public.landing.s5.steps.lookBody') }}</p></div></li>
            </ol>
          </div>
          <div v-reveal class="win rv">
            <div class="win-bar"><i></i><i></i><i></i><b>{{ $t('public.landing.s5.bar') }}</b><span class="tag-demo">{{ $t('public.landing.demo') }}</span><em>{{ $t('public.landing.s5.hint') }}</em></div>
            <div class="cf">
              <button v-for="item in changes" :key="item.id" type="button" class="chg" :class="{ on: item.on }" @click="item.on = !item.on">
                <span class="box">✓</span>
                <span class="t">{{ $t(item.kindKey) }}</span>
                <span class="d">{{ $t(item.textKey) }}</span>
              </button>
              <div class="bar">
                <span class="note">{{ $t('public.landing.s5.willWrite', { count: selectedCount }) }}</span>
                <span class="mini pri">{{ $t('public.landing.s5.confirm') }}</span>
              </div>
              <div class="ver">
                <div><span>{{ $t('public.landing.s5.ver1') }}</span><button type="button" class="link">{{ $t('public.landing.s5.undo') }}</button></div>
                <div><span>{{ $t('public.landing.s5.ver2') }}</span><span>{{ $t('public.landing.s5.undone') }}</span></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="compare">
        <div class="wrap">
          <div v-reveal class="head rv">
            <span class="pill"><i></i>{{ $t('public.landing.compare.pill') }}</span>
            <h2>{{ $t('public.landing.compare.title1') }}<br>{{ $t('public.landing.compare.title2') }}</h2>
          </div>
          <div class="vs">
            <article v-reveal class="rv"><h3>{{ $t('public.landing.compare.forget.title') }}</h3><p class="no"><span class="k">{{ $t('public.landing.compare.generic') }}</span>{{ $t('public.landing.compare.forget.no') }}</p><p class="yes"><span class="k">{{ $t('brand') }}</span>{{ $t('public.landing.compare.forget.yes') }}</p></article>
            <article v-reveal class="rv"><h3>{{ $t('public.landing.compare.drift.title') }}</h3><p class="no"><span class="k">{{ $t('public.landing.compare.generic') }}</span>{{ $t('public.landing.compare.drift.no') }}</p><p class="yes"><span class="k">{{ $t('brand') }}</span>{{ $t('public.landing.compare.drift.yes') }}</p></article>
            <article v-reveal class="rv"><h3>{{ $t('public.landing.compare.lost.title') }}</h3><p class="no"><span class="k">{{ $t('public.landing.compare.generic') }}</span>{{ $t('public.landing.compare.lost.no') }}</p><p class="yes"><span class="k">{{ $t('brand') }}</span>{{ $t('public.landing.compare.lost.yes') }}</p></article>
            <article v-reveal class="rv"><h3>{{ $t('public.landing.compare.full.title') }}</h3><p class="no"><span class="k">{{ $t('public.landing.compare.generic') }}</span>{{ $t('public.landing.compare.full.no') }}</p><p class="yes"><span class="k">{{ $t('brand') }}</span>{{ $t('public.landing.compare.full.yes') }}</p></article>
          </div>
        </div>
      </section>

      <section class="overview">
        <div class="wrap">
          <div v-reveal class="head rv">
            <span class="pill"><i></i>{{ $t('public.landing.overview.pill') }}</span>
            <h2>{{ $t('public.landing.overview.title') }}</h2>
            <p>{{ $t('public.landing.overview.sub') }}</p>
          </div>
          <ol class="flow">
            <li v-reveal class="rv"><span class="dot">01</span><div><h3>{{ $t('public.landing.overview.flow.book.title') }}</h3><p>{{ $t('public.landing.overview.flow.book.text') }}</p></div></li>
            <li v-reveal class="rv"><span class="dot">02</span><div><h3>{{ $t('public.landing.overview.flow.beats.title') }}</h3><p>{{ $t('public.landing.overview.flow.beats.text') }}</p></div></li>
            <li v-reveal class="rv"><span class="dot">03</span><div><h3>{{ $t('public.landing.overview.flow.draft.title') }}</h3><p>{{ $t('public.landing.overview.flow.draft.text') }}</p></div></li>
            <li v-reveal class="rv"><span class="dot">04</span><div><h3>{{ $t('public.landing.overview.flow.check.title') }}</h3><p>{{ $t('public.landing.overview.flow.check.text') }}</p></div></li>
            <li v-reveal class="rv"><span class="dot">05</span><div><h3>{{ $t('public.landing.overview.flow.confirm.title') }}</h3><p>{{ $t('public.landing.overview.flow.confirm.text') }}</p></div></li>
          </ol>
          <div v-reveal class="extras rv">
            <span>{{ $t('public.landing.overview.extras.chat') }}</span>
            <span>{{ $t('public.landing.overview.extras.versions') }}</span>
            <span>{{ $t('public.landing.overview.extras.search') }}</span>
            <span>{{ $t('public.landing.overview.extras.read') }}</span>
            <span>{{ $t('public.landing.overview.extras.export') }}</span>
            <span>{{ $t('public.landing.overview.extras.stats') }}</span>
            <span>{{ $t('public.landing.overview.extras.phone') }}</span>
          </div>
        </div>
      </section>

      <section class="info">
        <div class="wrap">
          <div v-reveal class="notes rv">
            <h2>{{ $t('public.landing.notes.title') }}</h2>
            <div class="note-card"><h3>{{ $t('public.landing.notes.key.title') }}</h3><p>{{ $t('public.landing.notes.key.body') }}</p></div>
            <div class="note-card"><h3>{{ $t('public.landing.notes.where.title') }}</h3><p>{{ $t('public.landing.notes.where.body') }}</p></div>
            <div class="note-card"><h3>{{ $t('public.landing.notes.own.title') }}</h3><p>{{ $t('public.landing.notes.own.body') }}</p></div>
          </div>
          <div v-reveal class="faq rv" id="faq">
            <h2>{{ $t('public.landing.faq.title') }}</h2>
            <details open>
              <summary>{{ $t('public.landing.faq.q1') }}</summary>
              <i18n-t keypath="public.landing.faq.a1" tag="p">
                <template #guide>
                  <router-link class="link" to="/guide">{{ $t('public.landing.nav.guide') }}</router-link>
                </template>
              </i18n-t>
            </details>
            <details>
              <summary>{{ $t('public.landing.faq.q2') }}</summary>
              <p>{{ $t('public.landing.faq.a2') }}</p>
            </details>
            <details>
              <summary>{{ $t('public.landing.faq.q3') }}</summary>
              <p>{{ $t('public.landing.faq.a3') }}</p>
            </details>
            <details>
              <summary>{{ $t('public.landing.faq.q4') }}</summary>
              <p>{{ $t('public.landing.faq.a4') }}</p>
            </details>
            <details>
              <summary>{{ $t('public.landing.faq.q5') }}</summary>
              <p>{{ $t('public.landing.faq.a5') }}</p>
            </details>
          </div>
        </div>
      </section>

      <section class="closing">
        <div v-reveal class="wrap rv">
          <h2>{{ $t('public.landing.closing.title1') }}<br>{{ $t('public.landing.closing.title2') }}</h2>
          <div class="actions">
            <router-link v-if="loggedIn" class="btn btn-primary btn-lg" to="/changjuan">{{ $t('public.landing.nav.shelf') }}</router-link>
            <template v-else>
              <router-link class="btn btn-primary btn-lg" to="/login">{{ $t('public.landing.nav.login') }}</router-link>
              <router-link class="btn btn-secondary btn-lg" to="/register">{{ $t('public.landing.nav.register') }}</router-link>
            </template>
          </div>
        </div>
      </section>
    </main>

    <footer class="foot">
      <div class="wrap">
        <BrandMark />
        <nav>
          <router-link to="/guide">{{ $t('public.landing.nav.guide') }}</router-link>
          <span>{{ $t('public.landing.footer.copy', { year }) }}</span>
        </nav>
      </div>
    </footer>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import './landing.css'
import BrandMark from '../../components/BrandMark.vue'
import LocaleSwitch from '../../components/LocaleSwitch.vue'

const { t } = useI18n()
const FORESHADOWS = [
  { id: 'scabbard', nameKey: 'public.landing.s3.items.scabbard', plant: 12, due: 60, whoKey: 'public.landing.cast.shen' },
  { id: 'pendant', nameKey: 'public.landing.s3.items.pendant', plant: 30, due: 75, whoKey: 'public.landing.cast.wen' },
  { id: 'pavilion', nameKey: 'public.landing.s3.items.pavilion', plant: 5, due: 52, whoKey: '' },
  { id: 'lastWords', nameKey: 'public.landing.s3.items.lastWords', plant: 41, due: 120, whoKey: 'public.landing.cast.lu', resolvedAt: 95 }
]
const REMIND_CHAPTERS = 3
const issues = [
  { key: 'must' },
  { key: 'should' },
  { key: 'hint' }
]

const reduceMotion = typeof window !== 'undefined'
  && typeof window.matchMedia === 'function'
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches

const loggedIn = ref(typeof localStorage !== 'undefined' && !!localStorage.getItem('token'))
const year = new Date().getFullYear()
const sampleProse = () => t('public.landing.hero.sample')
const typed = ref(reduceMotion ? sampleProse() : '')
const applied = ref(false)
const pins = ref({ vein: true, sect: false })
const chapter = ref(58)
const activeIssue = ref('must')
const changes = ref([
  { id: 'state', on: true, kindKey: 'public.landing.s5.changes.state.kind', textKey: 'public.landing.s5.changes.state.text' },
  { id: 'person', on: true, kindKey: 'public.landing.s5.changes.person.kind', textKey: 'public.landing.s5.changes.person.text' },
  { id: 'setting', on: false, kindKey: 'public.landing.s5.changes.setting.kind', textKey: 'public.landing.s5.changes.setting.text' },
  { id: 'hook', on: true, kindKey: 'public.landing.s5.changes.hook.kind', textKey: 'public.landing.s5.changes.hook.text' }
])

const wordCount = computed(() => 1200 + typed.value.length)
const selectedCount = computed(() => changes.value.filter(item => item.on).length)
const foreshadowRows = computed(() => {
  const current = Number(chapter.value)
  return FORESHADOWS.filter(item => current >= item.plant).map(item => {
    let state = ''
    let badge = t('public.landing.s3.badges.open')
    let injected = false
    if (item.resolvedAt && current >= item.resolvedAt) {
      state = 'done'
      badge = t('public.landing.s3.badges.done')
    } else if (current > item.due) {
      state = 'over'
      badge = t('public.landing.s3.badges.overdue', { n: current - item.due })
      injected = true
    } else if (item.due - current <= REMIND_CHAPTERS) {
      state = 'soon'
      badge = t('public.landing.s3.badges.soon', { n: item.due - current })
      injected = true
    } else if (item.whoKey === 'public.landing.cast.shen') {
      injected = true
    }
    return {
      ...item,
      name: t(item.nameKey),
      who: item.whoKey ? t(item.whoKey) : '',
      state,
      badge,
      injected
    }
  })
})

const markClass = (key) => (activeIssue.value === key ? `hl-${key}` : '')

const revealObservers = new WeakMap()
const vReveal = {
  mounted(el) {
    if (reduceMotion || typeof IntersectionObserver === 'undefined') {
      el.classList.add('in')
      return
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return
        entry.target.classList.add('in')
        observer.unobserve(entry.target)
      })
    }, { threshold: 0.12 })
    observer.observe(el)
    revealObservers.set(el, observer)
  },
  unmounted(el) {
    const observer = revealObservers.get(el)
    if (observer) observer.disconnect()
    revealObservers.delete(el)
  }
}

let typerTimer = 0
const stopTyper = () => {
  if (!typerTimer) return
  window.clearTimeout(typerTimer)
  typerTimer = 0
}
const tick = () => {
  const sample = sampleProse()
  if (typed.value.length < sample.length) {
    typed.value = sample.slice(0, typed.value.length + 1)
    typerTimer = window.setTimeout(tick, 70)
    return
  }
  typerTimer = window.setTimeout(() => {
    typed.value = ''
    tick()
  }, 2600)
}

onMounted(() => {
  if (!reduceMotion) tick()
})
onBeforeUnmount(stopTyper)
</script>
