import React from 'react';
import { User, Course, Session } from '../types';
import { StudentCheckinModal } from './StudentCheckinModal';

interface TeacherCheckinModalProps {
  isOpen: boolean;
  onClose: () => void;
  teacher: User;
  courses: Course[];
  sessionsMap?: Record<string, Session[]>;
  isDarkMode?: boolean;
  onCheckinSuccess?: () => void;
}

export const TeacherCheckinModal: React.FC<TeacherCheckinModalProps> = ({
  isOpen,
  onClose,
  teacher,
  courses,
  sessionsMap,
  isDarkMode = false,
  onCheckinSuccess,
}) => {
  return (
    <StudentCheckinModal
      isOpen={isOpen}
      onClose={onClose}
      teacher={teacher}
      userRole="TEACHER"
      courses={courses}
      sessionsMap={sessionsMap}
      isDarkMode={isDarkMode}
      onCheckinSuccess={onCheckinSuccess}
    />
  );
};
