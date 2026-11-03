// 과목 선택 칩: 설정의 과목 목록을 체크 칩으로 보여주고, "＋ 과목"으로 바로 새 과목을 추가
//   기록 화면(공부한 과목)과 뽀모도로 기록 창(어떤 공부를 했나요?)에서 같이 쓴다
(() => {
  "use strict";
  const { partChecksHtml, checkedValues } = DT.utils;

  class SubjectPicker {
    constructor(store, container) {
      this.store = store;
      this.el = container;
      this.el.addEventListener("click", (e) => {
        if (e.target.closest("[data-add-subject]")) this.addNew();
      });
    }

    // 선택된 값이 과목 목록에 없어도(지운 과목, 예전 기록) 칩으로 보여줌
    render(selected) {
      const names = [...this.store.subjects];
      (selected || []).forEach((n) => { if (!names.includes(n)) names.push(n); });
      this.el.innerHTML = partChecksHtml(names);
      this.set(selected || []);
    }

    get values() { return checkedValues(this.el); }
    set(values) { this.el.querySelectorAll("input").forEach((c) => (c.checked = values.includes(c.value))); }

    async addNew() {
      const name = ((await DT.ask.prompt("추가할 과목 이름", { placeholder: "예: 영어, 수학, 정보처리기사", maxLength: 12 })) || "").trim().slice(0, 12);
      if (!name) return;
      const keep = this.values;
      this.store.addSubject(name);
      this.render([...keep, name]); // 새 과목은 바로 선택
    }
  }

  DT.SubjectPicker = SubjectPicker;
})();
