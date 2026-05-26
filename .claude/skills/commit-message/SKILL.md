---
name: commit-message
description: 스테이징된 변경사항을 분석해 Conventional Commits 형식의 커밋 메시지를 생성합니다. "커밋 메시지 만들어줘", "commit 작성", "변경사항 커밋" 요청에 사용합니다.
disable-model-invocation: true
---

## 현재 스테이징된 변경사항

```diff
!`git diff --staged`
```

## 최근 커밋 스타일 참고

!`git log --oneline -5`

---

위 변경사항을 분석하여 Conventional Commits 형식으로 커밋 메시지를 작성하세요.
스테이징된 파일이 없으면 사용자에게 `git add` 먼저 실행하도록 안내하세요.

커밋 타입 힌트 (비어있으면 자동 판단): $ARGUMENTS

## Conventional Commits 타입 가이드

- `feat`: 새로운 기능 추가
- `fix`: 버그 수정
- `refactor`: 기능 변화 없는 코드 구조 개선
- `docs`: 문서만 변경
- `test`: 테스트 추가 또는 수정
- `chore`: 빌드 설정, 의존성 변경
- `perf`: 성능 개선
- `style`: 포맷, 세미콜론 등 (로직 변화 없음)

## 출력 형식

```
<type>(<scope>): <subject>

<body>
```

- subject는 50자 이하, 명령형 현재 시제로 작성합니다 (예: "add", "fix", "update")
- body는 변경 이유와 구체적인 내용을 2-3문장으로 작성합니다
- 마지막에 실제 사용 가능한 `git commit -m "..."` 명령어도 함께 제공합니다
