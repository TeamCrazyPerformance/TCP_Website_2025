// src/pages/admin/AdminAnnouncement.jsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faPlus,
  faEye,
  faEyeSlash,
  faTrash,
  faSearch,
  faSort,
  faChevronLeft,
  faChevronRight,
  faEdit,
} from '@fortawesome/free-solid-svg-icons';
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';

ChartJS.register(ArcElement, Tooltip, Legend);

// 더미 공지사항 데이터
const initialAnnouncements = [
  {
    id: 1,
    title: '2025학년도 2학기 신입 부원 모집 안내',
    category: 'recruitment',
    date: '2025-01-15',
    views: 245,
    status: 'active',
    author: '관리자',
  },
  {
    id: 2,
    title: '정기 스터디 개설 및 참여 독려',
    category: 'general',
    date: '2025-01-10',
    views: 189,
    status: 'active',
    author: '관리자',
  },
  {
    id: 3,
    title: '2025 TCP 해커톤 대회 참가 신청 안내',
    category: 'event',
    date: '2025-01-08',
    views: 312,
    status: 'active',
    author: '관리자',
  },
  {
    id: 4,
    title: '동아리 회칙 개정 안내',
    category: 'general',
    date: '2025-01-05',
    views: 156,
    status: 'inactive',
    author: '관리자',
  },
  {
    id: 5,
    title: '겨울방학 프로젝트 팀 모집',
    category: 'recruitment',
    date: '2024-12-20',
    views: 278,
    status: 'active',
    author: '관리자',
  },
  {
    id: 6,
    title: 'TCP 임시 휴회 공지',
    category: 'urgent',
    date: '2024-12-10',
    views: 500,
    status: 'inactive',
    author: '관리자',
  },
];

const itemsPerPage = 5;

function AdminAnnouncement() {
  const [announcements, setAnnouncements] = useState(initialAnnouncements);
  const [filteredAnnouncements, setFilteredAnnouncements] =
    useState(initialAnnouncements);
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  // 필터링 및 정렬 로직
  useEffect(() => {
    let newFiltered = announcements.filter((announcement) => {
      const matchesSearch =
        announcement.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        announcement.content?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory =
        !categoryFilter || announcement.category === categoryFilter;
      const matchesStatus =
        !statusFilter || announcement.status === statusFilter;
      // 날짜 필터링 로직 추가
      return matchesSearch && matchesCategory && matchesStatus;
    });

    // 정렬
    newFiltered.sort((a, b) => {
      let aVal = a[sortBy];
      let bVal = b[sortBy];
      if (sortBy === 'date') {
        aVal = new Date(aVal);
        bVal = new Date(bVal);
      }
      if (sortOrder === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });

    setFilteredAnnouncements(newFiltered);
    setCurrentPage(1); // 필터가 변경되면 1페이지로 이동
  }, [
    announcements,
    searchTerm,
    categoryFilter,
    statusFilter,
    sortBy,
    sortOrder,
  ]);

  const pageCount = Math.ceil(filteredAnnouncements.length / itemsPerPage);
  const paginatedAnnouncements = filteredAnnouncements.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // 통계 계산
  const totalAnnouncements = announcements.length;
  const activeCount = announcements.filter((a) => a.status === 'active').length;
  const inactiveCount = announcements.filter(
    (a) => a.status === 'inactive'
  ).length;
  const draftCount = announcements.filter((a) => a.status === 'draft').length;
  const totalViews = announcements.reduce((sum, a) => sum + a.views, 0);
  const categoryCounts = announcements.reduce((acc, a) => {
    acc[a.category] = (acc[a.category] || 0) + 1;
    return acc;
  }, {});

  // 차트 데이터
  const categoryChartData = {
    labels: ['일반공지', '행사안내', '모집공고', '긴급공지'],
    datasets: [
      {
        data: [
          categoryCounts.general || 0,
          categoryCounts.event || 0,
          categoryCounts.recruitment || 0,
          categoryCounts.urgent || 0,
        ],
        backgroundColor: ['#a8c5e6', '#a8e6c5', '#c5a8e6', '#ef4444'],
        borderWidth: 0,
      },
    ],
  };

  const categoryNames = {
    general: '일반공지',
    event: '행사안내',
    recruitment: '모집공고',
    urgent: '긴급공지',
  };

  const statusNames = {
    active: '활성',
    inactive: '비활성',
    draft: '임시저장',
  };

  const handleSort = (column) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
  };

  const handleCheckboxChange = (id) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedItems(newSelected);
  };

  const toggleSelectAll = (e) => {
    if (e.target.checked) {
      const allIds = new Set(paginatedAnnouncements.map((a) => a.id));
      setSelectedItems(allIds);
    } else {
      setSelectedItems(new Set());
    }
  };

  // 개별 액션
  const viewAnnouncement = (id) => {
    // 실제로는 navigate(`/announcement/${id}`) 사용
    alert(`공지사항 ID ${id} 보기`);
  };
  const editAnnouncement = (id) => {
    // 실제로는 navigate(`/announcement/edit/${id}`) 사용
    alert(`공지사항 ID ${id} 편집`);
  };
  const toggleStatus = (id) => {
    setAnnouncements(
      announcements.map((a) =>
        a.id === id
          ? { ...a, status: a.status === 'active' ? 'inactive' : 'active' }
          : a
      )
    );
    alert('상태가 변경되었습니다!');
  };
  const deleteAnnouncement = (id) => {
    if (window.confirm('정말로 이 공지사항을 삭제하시겠습니까?')) {
      setAnnouncements(announcements.filter((a) => a.id !== id));
      alert('공지사항이 삭제되었습니다.');
    }
  };

  // 일괄 액션
  const bulkActivate = () => {
    setAnnouncements(
      announcements.map((a) =>
        selectedItems.has(a.id) ? { ...a, status: 'active' } : a
      )
    );
    alert(`${selectedItems.size}개 공지사항이 활성화되었습니다.`);
    setSelectedItems(new Set());
  };
  const bulkDeactivate = () => {
    setAnnouncements(
      announcements.map((a) =>
        selectedItems.has(a.id) ? { ...a, status: 'inactive' } : a
      )
    );
    alert(`${selectedItems.size}개 공지사항이 비활성화되었습니다.`);
    setSelectedItems(new Set());
  };
  const bulkDelete = () => {
    if (
      window.confirm(
        `선택한 ${selectedItems.size}개 공지사항을 삭제하시겠습니까?`
      )
    ) {
      setAnnouncements(announcements.filter((a) => !selectedItems.has(a.id)));
      alert(`${selectedItems.size}개 공지사항이 삭제되었습니다.`);
      setSelectedItems(new Set());
    }
  };

  const isAllSelected =
    selectedItems.size > 0 &&
    selectedItems.size === paginatedAnnouncements.length;

  return (
    <div className="container mx-auto max-w-7xl">
      {/* Statistics Dashboard */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <h3 className="orbitron text-3xl font-bold gradient-text">
            공지사항 통계
          </h3>
          <Link to="/announcement/write" className="btn-primary">
            <FontAwesomeIcon icon={faPlus} className="mr-2" />새 공지사항 작성
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="widget-card p-6 rounded-xl">
            <h4 className="font-bold text-lg mb-4 text-blue-300">
              총 공지사항
            </h4>
            <div className="text-4xl font-black gradient-text mb-4">
              {totalAnnouncements}
            </div>
            <ul className="text-sm text-gray-300 space-y-2">
              <li className="flex justify-between">
                <span>활성</span>
                <span className="font-semibold text-green-400">
                  {activeCount}
                </span>
              </li>
              <li className="flex justify-between">
                <span>비활성</span>
                <span className="font-semibold text-red-400">
                  {inactiveCount}
                </span>
              </li>
              <li className="flex justify-between">
                <span>임시저장</span>
                <span className="font-semibold text-yellow-400">
                  {draftCount}
                </span>
              </li>
            </ul>
          </div>

          <div className="widget-card p-6 rounded-xl">
            <h4 className="font-bold text-lg mb-4 text-purple-300">
              총 조회수
            </h4>
            <div className="text-4xl font-black gradient-text mb-4">
              {totalViews.toLocaleString()}
            </div>
            <ul className="text-sm text-gray-300 space-y-2">
              <li className="flex justify-between">
                <span>이번 주</span>
                <span className="font-semibold text-white">423</span>
              </li>
              <li className="flex justify-between">
                <span>어제</span>
                <span className="font-semibold text-white">67</span>
              </li>
              <li className="flex justify-between">
                <span>오늘</span>
                <span className="font-semibold text-white">28</span>
              </li>
            </ul>
          </div>

          <div className="widget-card p-6 rounded-xl">
            <h4 className="font-bold text-lg mb-4 text-pink-300">
              카테고리별 현황
            </h4>
            <div className="chart-container">
              <Doughnut data={categoryChartData} />
            </div>
          </div>

          <div className="widget-card p-6 rounded-xl">
            <h4 className="font-bold text-lg mb-4 text-pink-300">최근 활동</h4>
            <div className="space-y-3">
              <div className="text-sm">
                <div className="flex items-center space-x-2 mb-1">
                  <FontAwesomeIcon icon={faPlus} className="text-green-400" />
                  <span className="text-gray-300">신규 모집 공고</span>
                </div>
                <div className="text-xs text-gray-500">2시간 전</div>
              </div>
              <div className="text-sm">
                <div className="flex items-center space-x-2 mb-1">
                  <FontAwesomeIcon icon={faEdit} className="text-blue-400" />
                  <span className="text-gray-300">스터디 공지 수정</span>
                </div>
                <div className="text-xs text-gray-500">5시간 전</div>
              </div>
              <div className="text-sm">
                <div className="flex items-center space-x-2 mb-1">
                  <FontAwesomeIcon icon={faTrash} className="text-red-400" />
                  <span className="text-gray-300">공지사항 삭제</span>
                </div>
                <div className="text-xs text-gray-500">1일 전</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Search and Filter */}
      <section className="mb-8">
        <div className="search-filter-card p-6 rounded-xl">
          <h3 className="orbitron text-3xl font-bold gradient-text mb-6">
            공지사항 관리
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label
                htmlFor="searchInput"
                className="block text-sm font-medium text-gray-300 mb-2"
              >
                검색
              </label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <FontAwesomeIcon
                    icon={faSearch}
                    className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                  />
                  <input
                    type="text"
                    id="searchInput"
                    className="form-input pl-10"
                    placeholder="제목 또는 내용 검색..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <button
                  type="button"
                  className="btn-secondary shrink-0 whitespace-nowrap px-4 py-2"
                  onClick={() =>
                    setAnnouncements(
                      announcements.filter(
                        (a) =>
                          a.title.includes(searchTerm) ||
                          a.content.includes(searchTerm)
                      )
                    )
                  }
                >
                  <FontAwesomeIcon icon={faSearch} className="mr-2" />
                  검색
                </button>
              </div>
            </div>

            <div>
              <label
                htmlFor="categoryFilter"
                className="block text-sm font-medium text-gray-300 mb-2"
              >
                카테고리
              </label>
              <select
                id="categoryFilter"
                className="form-input"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                <option value="">모든 카테고리</option>
                <option value="general">일반공지</option>
                <option value="event">행사안내</option>
                <option value="recruitment">모집공고</option>
                <option value="urgent">긴급공지</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="statusFilter"
                className="block text-sm font-medium text-gray-300 mb-2"
              >
                상태
              </label>
              <select
                id="statusFilter"
                className="form-input"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">모든 상태</option>
                <option value="active">활성</option>
                <option value="inactive">비활성</option>
                <option value="draft">임시저장</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="dateFilter"
                className="block text-sm font-medium text-gray-300 mb-2"
              >
                기간
              </label>
              <select
                id="dateFilter"
                className="form-input"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
              >
                <option value="">전체 기간</option>
                <option value="today">오늘</option>
                <option value="week">이번 주</option>
                <option value="month">이번 달</option>
                <option value="year">올해</option>
              </select>
            </div>
          </div>
        </div>
      </section>

      {/* Bulk Actions */}
      <section className="mb-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
          <div className="flex items-center space-x-4">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="selectAll"
                className="form-checkbox"
                checked={isAllSelected}
                onChange={toggleSelectAll}
              />
              <span className="text-sm text-gray-300">전체 선택</span>
            </label>
            <span className="text-sm text-gray-400">
              {selectedItems.size}개 선택됨
            </span>
          </div>

          {selectedItems.size > 0 && (
            <div className="flex flex-wrap gap-2" id="bulkActions">
              <button className="btn-success text-sm" onClick={bulkActivate}>
                <FontAwesomeIcon icon={faEye} className="mr-1" />
                활성화
              </button>
              <button className="btn-warning text-sm" onClick={bulkDeactivate}>
                <FontAwesomeIcon icon={faEyeSlash} className="mr-1" />
                비활성화
              </button>
              <button className="btn-danger text-sm" onClick={bulkDelete}>
                <FontAwesomeIcon icon={faTrash} className="mr-1" />
                삭제
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Announcements Table */}
      <section className="mb-8">
        <div className="widget-card rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-800">
                <tr>
                  <th className="p-4 w-10 text-left">
                    <input
                      type="checkbox"
                      id="headerCheckbox"
                      className="form-checkbox"
                      checked={isAllSelected}
                      onChange={toggleSelectAll}
                    />
                  </th>
                  <th
                    className="p-4 text-left sort-header"
                    onClick={() => handleSort('title')}
                  >
                    <div className="flex items-center">
                      제목
                      <FontAwesomeIcon
                        icon={faSort}
                        className="ml-2 text-gray-400"
                      />
                    </div>
                  </th>
                  <th
                    className="p-4 text-left sort-header"
                    onClick={() => handleSort('category')}
                  >
                    <div className="flex items-center">
                      카테고리
                      <FontAwesomeIcon
                        icon={faSort}
                        className="ml-2 text-gray-400"
                      />
                    </div>
                  </th>
                  <th
                    className="p-4 text-left sort-header"
                    onClick={() => handleSort('date')}
                  >
                    <div className="flex items-center">
                      게시일
                      <FontAwesomeIcon
                        icon={faSort}
                        className="ml-2 text-gray-400"
                      />
                    </div>
                  </th>
                  <th
                    className="p-4 text-left sort-header"
                    onClick={() => handleSort('views')}
                  >
                    <div className="flex items-center">
                      조회수
                      <FontAwesomeIcon
                        icon={faSort}
                        className="ml-2 text-gray-400"
                      />
                    </div>
                  </th>
                  <th className="p-4 text-left">상태</th>
                  <th className="p-4 text-left">작업</th>
                </tr>
              </thead>
              <tbody id="announcementsTable">
                {paginatedAnnouncements.map((announcement) => (
                  <tr key={announcement.id} className="table-row">
                    <td className="p-4">
                      <input
                        type="checkbox"
                        className="item-checkbox"
                        checked={selectedItems.has(announcement.id)}
                        onChange={() => handleCheckboxChange(announcement.id)}
                      />
                    </td>
                    <td className="p-4">
                      <div
                        className="font-semibold text-white cursor-pointer hover:text-blue-300"
                        onClick={() => viewAnnouncement(announcement.id)}
                      >
                        {announcement.title}
                      </div>
                      <div className="text-sm text-gray-400">
                        작성자: {announcement.author}
                      </div>
                    </td>
                    <td className="p-4">
                      <span
                        className={`status-badge category-${announcement.category}`}
                      >
                        {categoryNames[announcement.category]}
                      </span>
                    </td>
                    <td className="p-4 text-gray-300">{announcement.date}</td>
                    <td className="p-4 text-gray-300">
                      {announcement.views.toLocaleString()}
                    </td>
                    <td className="p-4">
                      <span
                        className={`status-badge status-${announcement.status}`}
                      >
                        {statusNames[announcement.status]}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex space-x-2">
                        <button
                          className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                          onClick={() => editAnnouncement(announcement.id)}
                        >
                          <FontAwesomeIcon icon={faEdit} />
                        </button>
                        <button
                          className={`px-2 py-1 text-xs text-white rounded ${announcement.status === 'active' ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-green-600 hover:bg-green-700'}`}
                          onClick={() => toggleStatus(announcement.id)}
                        >
                          <FontAwesomeIcon
                            icon={
                              announcement.status === 'active'
                                ? faEyeSlash
                                : faEye
                            }
                          />
                        </button>
                        <button
                          className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                          onClick={() => deleteAnnouncement(announcement.id)}
                        >
                          <FontAwesomeIcon icon={faTrash} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Pagination */}
      <section className="flex justify-center">
        <div className="flex items-center space-x-2">
          <button
            className="px-3 py-2 rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
            onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
          >
            <FontAwesomeIcon icon={faChevronLeft} />
          </button>
          {[...Array(pageCount)].map((_, i) => (
            <button
              key={i}
              className={`px-4 py-2 rounded-lg font-bold ${currentPage === i + 1 ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors'}`}
              onClick={() => setCurrentPage(i + 1)}
            >
              {i + 1}
            </button>
          ))}
          <button
            className="px-3 py-2 rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
            onClick={() =>
              setCurrentPage((prev) => Math.min(pageCount, prev + 1))
            }
          >
            <FontAwesomeIcon icon={faChevronRight} />
          </button>
        </div>
      </section>
    </div>
  );
}

export default AdminAnnouncement;
