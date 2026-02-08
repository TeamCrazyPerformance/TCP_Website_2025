// src/pages/admin/AdminAnnouncement.jsx
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faPlus,
  faTrash,
  faSearch,
  faSort,
  faChevronLeft,
  faChevronRight,
  faEdit,
} from '@fortawesome/free-solid-svg-icons';
import { apiGet, apiDelete } from '../../api/client';

const itemsPerPage = 5;

function AdminAnnouncement() {
  const navigate = useNavigate();
  const [announcements, setAnnouncements] = useState([]);
  const [filteredAnnouncements, setFilteredAnnouncements] = useState([]);
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // API에서 공지사항 목록 로드
  const loadAnnouncements = async () => {
    try {
      setIsLoading(true);
      const data = await apiGet('/api/v1/announcements');
      // API 응답 데이터 형식에 맞게 변환
      const formattedData = data.map((item) => ({
        id: item.id,
        title: item.title,
        date: item.publishAt ? new Date(item.publishAt).toISOString().split('T')[0] : '',
        views: item.views || 0,
      }));
      setAnnouncements(formattedData);
    } catch (error) {
      console.error('공지사항 로드 실패:', error);
      alert('공지사항을 불러오는데 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // 컴포넌트 마운트 시 데이터 로드
  useEffect(() => {
    loadAnnouncements();
  }, []);

  // 필터링 및 정렬 로직
  useEffect(() => {
    let newFiltered = announcements.filter((announcement) => {
      const matchesSearch =
        announcement.title.toLowerCase().includes(searchTerm.toLowerCase());
      
      // 상태 필터: 게시됨/예약됨
      const announcementStatus = getAnnouncementStatus(announcement.date);
      const matchesStatus = !statusFilter || announcementStatus === statusFilter;
      
      // 날짜 필터링: 게시일 기준
      let matchesDate = true;
      if (dateFilter && announcement.date) {
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        
        switch (dateFilter) {
          case 'today':
            matchesDate = announcement.date === todayStr;
            break;
          case 'week':
            const weekAgo = new Date();
            weekAgo.setDate(today.getDate() - 7);
            const weekAgoStr = weekAgo.toISOString().split('T')[0];
            matchesDate = announcement.date >= weekAgoStr && announcement.date <= todayStr;
            break;
          case 'month':
            const monthAgo = new Date();
            monthAgo.setMonth(today.getMonth() - 1);
            const monthAgoStr = monthAgo.toISOString().split('T')[0];
            matchesDate = announcement.date >= monthAgoStr && announcement.date <= todayStr;
            break;
          case 'year':
            const yearStart = new Date(today.getFullYear(), 0, 1);
            const yearStartStr = yearStart.toISOString().split('T')[0];
            matchesDate = announcement.date >= yearStartStr && announcement.date <= todayStr;
            break;
          default:
            matchesDate = true;
        }
      }
      
      return matchesSearch && matchesStatus && matchesDate;
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
    statusFilter,
    dateFilter,
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
  // 게시된 수 = 게시일이 지났거나 오늘인 공지
  const publishedCount = announcements.filter((a) => new Date(a.date) <= new Date()).length;
  // 예약된 수 = 게시일이 미래인 공지
  const scheduledCount = announcements.filter((a) => new Date(a.date) > new Date()).length;
  const totalViews = announcements.reduce((sum, a) => sum + a.views, 0);

  const statusNames = {
    published: '게시됨',
    scheduled: '예약됨',
  };

  // 공지사항의 상태 결정 함수
  const getAnnouncementStatus = (date) => {
    return new Date(date) <= new Date() ? 'published' : 'scheduled';
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
    navigate(`/announcement/${id}`, { state: { from: 'admin' } });
  };
  const editAnnouncement = (id) => {
    navigate(`/announcement/edit/${id}?from=admin`);
  };
  const deleteAnnouncement = async (id) => {
    if (window.confirm('정말로 이 공지사항을 삭제하시게습니까?')) {
      try {
        const token = localStorage.getItem('access_token');
        await apiDelete(`/api/v1/announcements/${id}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        alert('공지사항이 삭제되었습니다.');
        loadAnnouncements(); // 목록 재로드
      } catch (error) {
        console.error('공지사항 삭제 실패:', error);
        alert('공지사항 삭제에 실패했습니다.');
      }
    }
  };

  // 일괄 액션
  const bulkDelete = async () => {
    if (
      window.confirm(
        `선택한 ${selectedItems.size}개 공지사항을 삭제하시겠습니까?`
      )
    ) {
      try {
        const token = localStorage.getItem('access_token');
        // 선택된 모든 공지사항 삭제
        await Promise.all(
          Array.from(selectedItems).map((id) =>
            apiDelete(`/api/v1/announcements/${id}`, {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            })
          )
        );
        alert(`${selectedItems.size}개 공지사항이 삭제되었습니다.`);
        setSelectedItems(new Set());
        loadAnnouncements(); // 목록 재로드
      } catch (error) {
        console.error('일괄 삭제 실패:', error);
        alert('공지사항 삭제에 실패했습니다.');
      }
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
          <Link to="/announcement/write?from=admin" className="btn-primary">
            <FontAwesomeIcon icon={faPlus} className="mr-2" />새 공지사항 작성
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="widget-card p-4 rounded-xl">
            <div className="text-gray-400 text-sm">총 공지사항</div>
            <div className="text-2xl font-bold text-white">{totalAnnouncements}개</div>
          </div>
          <div className="widget-card p-4 rounded-xl">
            <div className="text-gray-400 text-sm">게시된 공지</div>
            <div className="text-2xl font-bold text-green-400">{publishedCount}개</div>
          </div>
          <div className="widget-card p-4 rounded-xl">
            <div className="text-gray-400 text-sm">예약된 공지</div>
            <div className="text-2xl font-bold text-yellow-400">{scheduledCount}개</div>
          </div>
          <div className="widget-card p-4 rounded-xl">
            <div className="text-gray-400 text-sm">총 조회수</div>
            <div className="text-2xl font-bold text-blue-400">{totalViews.toLocaleString()}</div>
          </div>
        </div>
      </section>

      {/* Search and Filter */}
      <section className="mb-8">
        <div className="search-filter-card p-6 rounded-xl">
          <h3 className="orbitron text-3xl font-bold gradient-text mb-6">
            공지사항 관리
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label
                htmlFor="searchInput"
                className="block text-sm font-medium text-gray-300 mb-2"
              >
                검색
              </label>
              <div className="relative">
                <FontAwesomeIcon
                  icon={faSearch}
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                />
                <input
                  type="text"
                  id="searchInput"
                  className="form-input pl-10"
                  placeholder="제목 검색"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
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
                <option value="" className="bg-gray-800 text-white">모든 상태</option>
                <option value="published" className="bg-gray-800 text-white">게시됨</option>
                <option value="scheduled" className="bg-gray-800 text-white">예약됨</option>
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
                <option value="" className="bg-gray-800 text-white">전체 기간</option>
                <option value="today" className="bg-gray-800 text-white">오늘</option>
                <option value="week" className="bg-gray-800 text-white">이번 주</option>
                <option value="month" className="bg-gray-800 text-white">이번 달</option>
                <option value="year" className="bg-gray-800 text-white">올해</option>
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
                  <th className="p-4 text-center" style={{width: '40px'}}>
                    <input
                      type="checkbox"
                      id="headerCheckbox"
                      className="form-checkbox"
                      checked={isAllSelected}
                      onChange={toggleSelectAll}
                    />
                  </th>
                  <th
                    className="p-4 text-center sort-header"
                    onClick={() => handleSort('title')}
                  >
                    <div className="flex items-center justify-center">
                      제목
                      <FontAwesomeIcon
                        icon={faSort}
                        className="ml-2 text-gray-400"
                      />
                    </div>
                  </th>
                  <th
                    className="p-4 text-center sort-header"
                    onClick={() => handleSort('date')}
                    style={{width: '150px'}}
                  >
                    <div className="flex items-center justify-center">
                      게시일(예정일)
                      <FontAwesomeIcon
                        icon={faSort}
                        className="ml-2 text-gray-400"
                      />
                    </div>
                  </th>
                  <th
                    className="p-4 text-center sort-header"
                    onClick={() => handleSort('views')}
                    style={{width: '100px'}}
                  >
                    <div className="flex items-center justify-center">
                      조회수
                      <FontAwesomeIcon
                        icon={faSort}
                        className="ml-2 text-gray-400"
                      />
                    </div>
                  </th>
                  <th className="p-4 text-center" style={{width: '100px'}}>상태</th>
                  <th className="p-4 text-center" style={{width: '100px'}}>작업</th>
                </tr>
              </thead>
              <tbody id="announcementsTable">
                {isLoading ? (
                  <tr>
                    <td colSpan="6" className="p-8 text-center text-gray-400">
                      <i className="fas fa-spinner fa-spin mr-2"></i>
                      로딩 중...
                    </td>
                  </tr>
                ) : paginatedAnnouncements.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="p-8 text-center text-gray-400">
                      공지사항이 없습니다.
                    </td>
                  </tr>
                ) : (
                  paginatedAnnouncements.map((announcement) => (
                  <tr key={announcement.id} className="table-row">
                    <td className="p-4 text-center">
                      <input
                        type="checkbox"
                        className="item-checkbox"
                        checked={selectedItems.has(announcement.id)}
                        onChange={() => handleCheckboxChange(announcement.id)}
                      />
                    </td>
                    <td className="p-4 text-center">
                      <div
                        className="font-semibold text-white cursor-pointer hover:text-blue-300"
                        onClick={() => viewAnnouncement(announcement.id)}
                      >
                        {announcement.title}
                      </div>
                    </td>
                    <td className="p-4 text-center text-gray-300">{announcement.date}</td>
                    <td className="p-4 text-center text-gray-300">
                      {announcement.views.toLocaleString()}
                    </td>
                    <td className="p-4 text-center">
                      <span
                        className={`status-badge status-${getAnnouncementStatus(announcement.date)}`}
                      >
                        {statusNames[getAnnouncementStatus(announcement.date)]}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex space-x-2">
                        <button
                          className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                          onClick={() => editAnnouncement(announcement.id)}
                        >
                          <FontAwesomeIcon icon={faEdit} />
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
                  ))
                )}
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
