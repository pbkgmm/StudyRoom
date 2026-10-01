/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useId, useEffect } from 'react';
import * as XLSX from 'xlsx';

// 스터디룸 정보 타입 정의
interface StudyRoom {
  id: string;
  name: string;
  hourlyPrice: number;
  maxCapacity: number;
  description: string;
}

// 대여 장비 정보 타입 정의
interface RentalEquipment {
  id: string;
  name: string; // 확인 메시지 및 엑셀에 노출될 장비명
  label: string; // 체크박스 레이블 텍스트
  price: number; // 대여 금액 (예약 1건당 1회 부과)
}

// 예약 내역 레코드 타입 정의 (엑셀 파일 정리 및 현황 보관용)
interface ReservationRecord {
  id: string;
  createdAt: string;
  name: string;
  phone: string;
  roomName: string;
  hours: number;
  equipments: string[];
  userCount: number;
  totalPrice: number;
  notes: string;
  status: string;
}

// 스터디룸 데이터 목록 (1시간 당 가격 및 최대 수용 인원)
const STUDY_ROOMS: StudyRoom[] = [
  { id: 'single', name: '개인실', hourlyPrice: 8000, maxCapacity: 1, description: '1인 전용 몰입 공간' },
  { id: 'double', name: '2인실', hourlyPrice: 10000, maxCapacity: 2, description: '1~2인 스터디 및 과외' },
  { id: 'triple', name: '3인실', hourlyPrice: 12000, maxCapacity: 3, description: '소규모 팀 프로젝트' },
  { id: 'quad', name: '4인실', hourlyPrice: 14000, maxCapacity: 4, description: '그룹 스터디 및 회의' },
  { id: 'seminar', name: '대형 세미나실', hourlyPrice: 18000, maxCapacity: 12, description: '최대 12인 세미나 & 워크숍' },
];

// 대여 장비 데이터 목록
const EQUIPMENT_LIST: RentalEquipment[] = [
  { id: 'beam', name: '빔 프로젝터', label: '빔 프로젝터 +500원', price: 500 },
  { id: 'whiteboard', name: '화이트 보드', label: '화이트 보드 +500원', price: 500 },
  { id: 'charger', name: '충전기', label: '충전기 +300원', price: 300 },
  { id: 'earphone', name: '이어폰', label: '이어폰 +0원', price: 0 },
];

// 이용 시간 선택 옵션 (1시간 ~ 4시간)
const TIME_OPTIONS = [1, 2, 3, 4];

export default function App() {
  // 1. 입력 폼 상태 관리
  const [userName, setUserName] = useState<string>(''); // 예약자 이름
  const [userPhone, setUserPhone] = useState<string>(''); // 대표자 전화번호
  const [selectedRoomId, setSelectedRoomId] = useState<string>(''); // 선택된 스터디룸 ID
  const [usageHours, setUsageHours] = useState<number>(1); // 이용 시간 (기본값: 1시간)
  const [selectedEquipments, setSelectedEquipments] = useState<string[]>([]); // 선택한 대여 장비 ID 배열
  const [userCount, setUserCount] = useState<number>(1); // 사용 인원 (기본값: 1명)
  const [requestNotes, setRequestNotes] = useState<string>(''); // 추가 요청사항

  // 2. 유효성 검사 안내 및 결과 상태
  const [capacityNotice, setCapacityNotice] = useState<string>(''); // 인원 제한 초과 안내 문구
  const [confirmationMessage, setConfirmationMessage] = useState<string | null>(null); // 예약 완료 확인 메시지
  const [alertPopupMessage, setAlertPopupMessage] = useState<string | null>(null); // 필수 입력 경고 알림

  // 3. 예약 현황 목록 상태 (엑셀 파일로 정리 및 다운로드용)
  const [reservations, setReservations] = useState<ReservationRecord[]>(() => {
    try {
      const saved = localStorage.getItem('study_room_reservations');
      if (saved) return JSON.parse(saved);
    } catch {
      // 로컬 스토리지 파싱 에러 방지
    }
    return [];
  });

  // 예약 목록 변경 시 로컬 스토리지 동기화
  useEffect(() => {
    try {
      localStorage.setItem('study_room_reservations', JSON.stringify(reservations));
    } catch {
      // 로컬 스토리지 저장 에러 무시
    }
  }, [reservations]);

  // 고유 ID 생성 (접근성: label htmlFor 연결)
  const baseId = useId();
  const nameInputId = `${baseId}-name`;
  const phoneInputId = `${baseId}-phone`;
  const roomSelectId = `${baseId}-room`;
  const userCountInputId = `${baseId}-count`;
  const notesTextareaId = `${baseId}-notes`;

  // 현재 선택된 스터디룸 객체 조회
  const selectedRoom = STUDY_ROOMS.find((room) => room.id === selectedRoomId);

  // 현재 허용 가능한 최대 수용 인원 (룸 미선택 시 기본 12명)
  const currentMaxCapacity = selectedRoom ? selectedRoom.maxCapacity : 12;

  // 4. 실시간 예상 금액 계산
  // 규칙: (스터디룸 1시간 가격 × 이용 시간) + 선택한 대여 장비 금액 합계
  // 스터디룸 미선택 시 0원으로 표시
  const calculatedTotalPrice = (() => {
    if (!selectedRoom) return 0;

    // 스터디룸 기본 이용료
    const roomCost = selectedRoom.hourlyPrice * usageHours;

    // 대여 장비 금액 합계 (예약 1건당 1회 적용)
    const equipmentCost = selectedEquipments.reduce((sum, eqId) => {
      const eq = EQUIPMENT_LIST.find((item) => item.id === eqId);
      return sum + (eq ? eq.price : 0);
    }, 0);

    return roomCost + equipmentCost;
  })();

  // 5. 스터디룸 변경 핸들러
  const handleRoomChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newRoomId = e.target.value;
    setSelectedRoomId(newRoomId);

    // 스터디룸 변경 시 해당 룸의 최대 인원 체크
    if (newRoomId) {
      const targetRoom = STUDY_ROOMS.find((r) => r.id === newRoomId);
      if (targetRoom) {
        if (userCount > targetRoom.maxCapacity) {
          // 현재 인원이 새로 선택한 방의 최대 인원보다 많으면 안내 문구 표시 및 자동 조정
          setCapacityNotice(`${targetRoom.name}은 최대 ${targetRoom.maxCapacity}명까지 이용 가능합니다`);
          setUserCount(targetRoom.maxCapacity);
        } else {
          setCapacityNotice('');
        }
      }
    } else {
      setCapacityNotice('');
    }
  };

  // 6. 사용 인원 입력 변경 핸들러
  const handleUserCountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    if (rawVal === '') {
      setUserCount(1);
      return;
    }

    const val = parseInt(rawVal, 10);
    if (isNaN(val)) return;

    if (val < 1) {
      setUserCount(1);
      return;
    }

    if (selectedRoom && val > selectedRoom.maxCapacity) {
      // 선택된 방의 최대 인원을 초과하는 경우 안내 문구 노출 및 최대치로 제한
      setCapacityNotice(`${selectedRoom.name}은 최대 ${selectedRoom.maxCapacity}명까지 이용 가능합니다`);
      setUserCount(selectedRoom.maxCapacity);
    } else {
      setCapacityNotice('');
      setUserCount(val);
    }
  };

  // 7. 대여 장비 체크박스 토글 핸들러
  const handleEquipmentToggle = (equipmentId: string) => {
    setSelectedEquipments((prev) =>
      prev.includes(equipmentId) ? prev.filter((id) => id !== equipmentId) : [...prev, equipmentId]
    );
  };

  // 8. 엑셀 파일 생성 및 다운로드 함수 (.xlsx)
  const exportReservationsToExcel = (recordList: ReservationRecord[], customFileName?: string) => {
    if (recordList.length === 0) {
      triggerAlert('엑셀로 내보낼 예약 내역이 없습니다.');
      return;
    }

    // 엑셀 시트 행 데이터 구성
    const sheetData = recordList.map((item, index) => ({
      '순번': index + 1,
      '예약일시': item.createdAt,
      '예약자명': item.name,
      '전화번호': item.phone || '-',
      '스터디룸': item.roomName,
      '이용시간': `${item.hours}시간`,
      '대여장비': item.equipments.length > 0 ? item.equipments.join(', ') : '없음',
      '사용인원': `${item.userCount}명`,
      '결제금액': `${item.totalPrice.toLocaleString()}원`,
      '요청사항': item.notes || '-',
      '상태': item.status,
    }));

    // 워크시트 생성
    const worksheet = XLSX.utils.json_to_sheet(sheetData);

    // 컬럼 너비 설정 (한글 가독성 고려)
    worksheet['!cols'] = [
      { wch: 6 },  // 순번
      { wch: 20 }, // 예약일시
      { wch: 12 }, // 예약자명
      { wch: 16 }, // 전화번호
      { wch: 14 }, // 스터디룸
      { wch: 10 }, // 이용시간
      { wch: 24 }, // 대여장비
      { wch: 10 }, // 사용인원
      { wch: 14 }, // 결제금액
      { wch: 30 }, // 요청사항
      { wch: 10 }, // 상태
    ];

    // 워크북 생성 및 시트 추가
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '예약현황');

    // 파일 다운로드 실행
    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const fileName = customFileName || `스터디룸_예약현황_${dateStr}.xlsx`;

    XLSX.writeFile(workbook, fileName);
  };

  // 9. 시스템 알림 함수 (사용자 환경 제약 조건 고려 및 테스트 호환성 유지)
  const triggerAlert = (message: string) => {
    setAlertPopupMessage(message);
    try {
      if (typeof window !== 'undefined' && window.alert) {
        window.alert(message);
      }
    } catch {
      // iframe 샌드박스에서 window.alert 차단 시 안전하게 UI 모달로 표시
    }
  };

  // 10. 예약하기(주문하기) 버튼 클릭 핸들러
  // 위에서부터 순서대로 검사하고 하나라도 걸리면 알림 후 중단
  const handleReservationSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // 1) 이름 유효성 검사
    if (!userName.trim()) {
      triggerAlert('이름을 입력해주세요');
      return;
    }

    // 2) 스터디룸 선택 유효성 검사
    if (!selectedRoom) {
      triggerAlert('스터디룸을 선택해주세요');
      return;
    }

    // 3) 사용 인원 유효성 검사 (선택한 방의 최대 인원 초과 여부)
    if (userCount > selectedRoom.maxCapacity) {
      triggerAlert(`${selectedRoom.name}은 최대 ${selectedRoom.maxCapacity}명까지 이용 가능합니다`);
      return;
    }

    // 4) 예약 확인 메시지 생성
    // 장비 선택 유무에 따라 괄호 표기 분기
    const selectedEqNames = selectedEquipments
      .map((id) => EQUIPMENT_LIST.find((eq) => eq.id === id)?.name)
      .filter(Boolean) as string[];

    let msg = '';
    if (selectedEqNames.length > 0) {
      const eqString = selectedEqNames.join(', ');
      msg = `${userName.trim()}님, ${selectedRoom.name} ${usageHours}시간 (${eqString}) ${userCount}명, 총 ${calculatedTotalPrice.toLocaleString()}원 예약이 접수되었습니다!`;
    } else {
      msg = `${userName.trim()}님, ${selectedRoom.name} ${usageHours}시간 ${userCount}명, 총 ${calculatedTotalPrice.toLocaleString()}원 예약이 접수되었습니다!`;
    }

    setConfirmationMessage(msg);

    // 5) 예약 결과 및 현황을 레코드에 추가하고 엑셀 파일로 정리
    const now = new Date();
    const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const newRecord: ReservationRecord = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      createdAt: formattedDate,
      name: userName.trim(),
      phone: userPhone.trim(),
      roomName: selectedRoom.name,
      hours: usageHours,
      equipments: selectedEqNames,
      userCount: userCount,
      totalPrice: calculatedTotalPrice,
      notes: requestNotes.trim(),
      status: '예약완료',
    };

    const updatedList = [newRecord, ...reservations];
    setReservations(updatedList);

    // 예약 완료 즉시 엑셀 파일로 정리하여 자동 다운로드
    try {
      exportReservationsToExcel(
        updatedList,
        `스터디룸_예약접수_${userName.trim()}_${now.toISOString().slice(0, 10)}.xlsx`
      );
    } catch {
      // 엑셀 내보내기 오류 방지
    }
  };

  // 11. 다시 작성(초기화) 버튼 핸들러
  // 모든 입력값, 기본값, 안내 문구, 예상 금액(0원), 예약 확인 메시지 초기화
  const handleReset = () => {
    setUserName('');
    setUserPhone('');
    setSelectedRoomId('');
    setUsageHours(1);
    setSelectedEquipments([]);
    setUserCount(1);
    setRequestNotes('');
    setCapacityNotice('');
    setConfirmationMessage(null);
    setAlertPopupMessage(null);
  };

  // 예약 내역 삭제 핸들러
  const handleDeleteReservation = (id: string) => {
    setReservations((prev) => prev.filter((item) => item.id !== id));
  };

  return (
    <div className="min-h-screen bg-slate-100 py-8 px-4 flex flex-col items-center text-slate-800">
      {/* 화면 중앙 정렬 및 최대 너비 520px 제한 컨테이너 */}
      <main className="w-full max-w-[520px] bg-white rounded-2xl shadow-xl shadow-slate-300/60 overflow-hidden border border-slate-200">
        
        {/* [페이지 상단 헤더] */}
        <header className="bg-[#1E3A8A] text-white pt-8 pb-7 px-6 text-center shadow-md relative">
          <div className="inline-block text-5xl mb-2 filter drop-shadow-md" role="img" aria-label="책 아이콘">
            📚
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white mb-1">
            스터디룸
          </h1>
          <p className="text-blue-100 text-sm font-medium tracking-wide">
            집중을 위한 공간
          </p>
        </header>

        {/* [주문서 폼 영역] */}
        <form onSubmit={handleReservationSubmit} className="p-6 sm:p-7 space-y-6" noValidate>

          {/* 1. 이름 (필수, text) */}
          <div className="space-y-1.5">
            <label htmlFor={nameInputId} className="block text-sm font-semibold text-slate-800">
              이름 <span className="text-red-500 font-bold" title="필수 항목">*</span>
            </label>
            <input
              id={nameInputId}
              type="text"
              required
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="예약자 성함을 입력해주세요"
              className="custom-input text-sm text-slate-900 placeholder:text-slate-400"
            />
          </div>

          {/* 2. 대표자 전화번호 (tel) */}
          <div className="space-y-1.5">
            <label htmlFor={phoneInputId} className="block text-sm font-semibold text-slate-800">
              대표자 전화번호
            </label>
            <input
              id={phoneInputId}
              type="tel"
              value={userPhone}
              onChange={(e) => setUserPhone(e.target.value)}
              placeholder="010-0000-0000"
              className="custom-input text-sm text-slate-900 placeholder:text-slate-400"
            />
          </div>

          {/* 3. 스터디룸 선택 (1시간 당) (드롭다운) */}
          <div className="space-y-1.5">
            <label htmlFor={roomSelectId} className="block text-sm font-semibold text-slate-800">
              스터디룸 선택(1시간 당) <span className="text-red-500 font-bold" title="필수 항목">*</span>
            </label>
            <select
              id={roomSelectId}
              value={selectedRoomId}
              onChange={handleRoomChange}
              className="custom-input text-sm text-slate-900 cursor-pointer"
            >
              <option value="">스터디룸을 선택해주세요</option>
              {STUDY_ROOMS.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.name} {room.hourlyPrice.toLocaleString()}원
                </option>
              ))}
            </select>
          </div>

          {/* 4. 시간 (라디오 버튼, 가로 배치) */}
          <div className="space-y-2">
            <span className="block text-sm font-semibold text-slate-800">
              이용 시간 (1시간 간격)
            </span>
            <div className="flex flex-row flex-wrap items-center gap-x-5 gap-y-2 pt-1">
              {TIME_OPTIONS.map((hour) => {
                const radioId = `${baseId}-time-${hour}`;
                return (
                  <div key={hour} className="flex items-center space-x-1.5">
                    <input
                      type="radio"
                      id={radioId}
                      name="usage-hours"
                      value={hour}
                      checked={usageHours === hour}
                      onChange={() => setUsageHours(hour)}
                      className="w-4 h-4 text-[#1E3A8A] focus:ring-[#1E3A8A] focus:ring-2 cursor-pointer"
                    />
                    <label
                      htmlFor={radioId}
                      className="text-sm font-medium text-slate-700 cursor-pointer select-none"
                    >
                      {hour}시간
                    </label>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 5. 대여 장비 (체크박스, 가로 배치) */}
          <div className="space-y-2">
            <span className="block text-sm font-semibold text-slate-800">
              대여 장비 (예약 건당 1회 부과)
            </span>
            <div className="flex flex-row flex-wrap items-center gap-x-4 gap-y-2 pt-1">
              {EQUIPMENT_LIST.map((equipment) => {
                const checkId = `${baseId}-eq-${equipment.id}`;
                const isChecked = selectedEquipments.includes(equipment.id);
                return (
                  <div key={equipment.id} className="flex items-center space-x-1.5">
                    <input
                      type="checkbox"
                      id={checkId}
                      checked={isChecked}
                      onChange={() => handleEquipmentToggle(equipment.id)}
                      className="w-4 h-4 rounded text-[#1E3A8A] focus:ring-[#1E3A8A] focus:ring-2 cursor-pointer"
                    />
                    <label
                      htmlFor={checkId}
                      className="text-sm font-medium text-slate-700 cursor-pointer select-none"
                    >
                      {equipment.label}
                    </label>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 6. 사용 인원 (number 타입, 최소 1, 최대 12, 기본값 1) */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label htmlFor={userCountInputId} className="block text-sm font-semibold text-slate-800">
                사용 인원
              </label>
              {selectedRoom && (
                <span className="text-xs text-slate-500 font-medium">
                  {selectedRoom.name} 정원: 최대 {selectedRoom.maxCapacity}명
                </span>
              )}
            </div>
            <input
              id={userCountInputId}
              type="number"
              min={1}
              max={currentMaxCapacity}
              value={userCount}
              onChange={handleUserCountChange}
              className="custom-input text-sm text-slate-900 font-medium"
            />
            {/* 인원 제한 초과 안내 문구 */}
            {capacityNotice && (
              <p className="text-xs font-semibold text-rose-600 pt-0.5">
                ⚠️ {capacityNotice}
              </p>
            )}
          </div>

          {/* 7. 요청사항 (textarea) */}
          <div className="space-y-1.5">
            <label htmlFor={notesTextareaId} className="block text-sm font-semibold text-slate-800">
              요청사항
            </label>
            <textarea
              id={notesTextareaId}
              rows={3}
              value={requestNotes}
              onChange={(e) => setRequestNotes(e.target.value)}
              placeholder="추가 요청사항이나 필요한 사항을 남겨주세요 (선택)"
              className="custom-input text-sm text-slate-900 placeholder:text-slate-400 resize-none"
            />
          </div>

          {/* [예상 금액 영역: 예약하기 버튼 바로 위 큰 글씨(24px), 갈색 (#8B4513), 굵게, 가운데 정렬] */}
          <div className="pt-3 pb-1 text-center border-t border-slate-100">
            <span className="block text-xs uppercase tracking-wider text-slate-400 font-bold mb-1">
              ESTIMATED TOTAL
            </span>
            <div
              className="font-bold text-center tracking-tight"
              style={{ fontSize: '24px', color: '#8B4513' }}
            >
              예상 금액: {calculatedTotalPrice.toLocaleString()}원
            </div>
          </div>

          {/* 버튼 영역: 8. 예약하기 버튼 & 9. 다시 작성 버튼 */}
          <div className="space-y-2.5 pt-2">
            {/* 8. 예약하기 버튼: 스카이블루 배경 (#E0F2FE), 흰색 글씨, hover 시 약간 밝게 */}
            <button
              type="submit"
              className="order-btn w-full py-3.5 px-4 rounded-xl cursor-pointer text-base tracking-wide flex items-center justify-center shadow-sm"
            >
              예약하기
            </button>

            {/* 9. 다시 작성 버튼: 초기화 */}
            <button
              type="button"
              onClick={handleReset}
              className="w-full py-2.5 px-4 rounded-xl text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-200/80 transition-colors cursor-pointer"
            >
              다시 작성
            </button>
          </div>

          {/* [주문 확인 메시지] 청록색 배경, 초록 글씨, 둥근 모서리 */}
          {confirmationMessage && (
            <div className="mt-5 p-4 rounded-xl bg-teal-50 border border-teal-200 text-teal-800 font-medium text-sm leading-relaxed shadow-sm">
              <div className="flex items-start space-x-2">
                <span className="text-teal-600 text-lg leading-none font-bold">✓</span>
                <div className="w-full">
                  <p className="font-bold text-teal-900 mb-0.5">예약이 성공적으로 완료되었습니다!</p>
                  <p className="text-teal-800 break-words mb-3">{confirmationMessage}</p>
                  
                  {/* 엑셀 저장 알림 및 수동 다운로드 버튼 */}
                  <div className="pt-2 border-t border-teal-200/60 flex items-center justify-between flex-wrap gap-2">
                    <span className="text-xs text-teal-700 font-normal">
                      📊 예약 결과가 엑셀 파일로 정리되었습니다.
                    </span>
                    <button
                      type="button"
                      onClick={() => exportReservationsToExcel(reservations)}
                      className="px-3 py-1.5 text-xs font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors cursor-pointer shadow-xs inline-flex items-center space-x-1"
                    >
                      <span>📗</span>
                      <span>엑셀 다시 다운로드</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

        </form>

        {/* [예약 현황 목록 및 엑셀 다운로드 섹션] */}
        <section className="bg-slate-50 border-t border-slate-200 p-6">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center space-x-1.5">
                <span>📋</span>
                <span>예약 현황 및 관리</span>
              </h2>
              <p className="text-xs text-slate-500">
                총 {reservations.length}건의 예약 내역
              </p>
            </div>

            {/* 엑셀 파일 다운로드 버튼 */}
            <button
              type="button"
              onClick={() => exportReservationsToExcel(reservations)}
              disabled={reservations.length === 0}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center space-x-1.5 transition-all shadow-xs cursor-pointer ${
                reservations.length > 0
                  ? 'bg-emerald-700 hover:bg-emerald-800 text-white'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              <span>📗</span>
              <span>현황 엑셀 다운로드 (.xlsx)</span>
            </button>
          </div>

          {reservations.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-400 bg-white rounded-xl border border-dashed border-slate-200">
              아직 등록된 예약이 없습니다.<br />위 폼에서 예약하기를 진행하면 자동으로 엑셀 파일이 생성됩니다.
            </div>
          ) : (
            <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
              {reservations.map((item, index) => (
                <div
                  key={item.id}
                  className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between text-xs hover:border-blue-300 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-slate-900 text-sm">
                        {item.name}
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-blue-50 text-[#1E3A8A] font-semibold text-[11px]">
                        {item.roomName} ({item.hours}시간)
                      </span>
                      <span className="text-slate-400 text-[11px]">
                        {item.userCount}명
                      </span>
                    </div>
                    <div className="text-slate-500 text-[11px]">
                      {item.equipments.length > 0 ? `장비: ${item.equipments.join(', ')} | ` : ''}
                      금액: <strong className="text-amber-800 font-bold">{item.totalPrice.toLocaleString()}원</strong>
                      {item.phone && ` | ${item.phone}`}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {item.createdAt}
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => handleDeleteReservation(item.id)}
                      className="text-slate-400 hover:text-rose-500 p-1 cursor-pointer"
                      title="내역 삭제"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

      </main>

      {/* [경고 알림 모달/팝업 UI: iframe 환경 대응 및 시각적 안내] */}
      {alertPopupMessage && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-slate-200 text-center">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 text-xl font-bold">
              !
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-2">알림</h3>
            <p className="text-sm text-slate-600 mb-5 leading-normal">
              {alertPopupMessage}
            </p>
            <button
              type="button"
              onClick={() => setAlertPopupMessage(null)}
              className="w-full py-2.5 px-4 bg-[#1E3A8A] text-white text-sm font-semibold rounded-lg hover:bg-blue-900 transition-colors cursor-pointer"
            >
              확인
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
